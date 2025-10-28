// thesportsdb.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

export type MatchStatus = 'FINISHED' | 'SCHEDULED';
export interface Team {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string | null;
  record: string;
}

export interface Match {
  id: number;
  week: string;   // "01", "02", ...
  date: string;   // "11 Jul"
  time: string;   // "20:05"
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number | null;
  awayScore?: number | null;
  homeProb?: number;
  awayProb?: number;
}

type TSDBEvent = {
  idEvent: string;
  intRound: string | number;
  strStatus: string | null;
  dateEvent: string | null;
  dateEventLocal: string | null;
  strTime: string | null;
  strTimeLocal: string | null;

  idHomeTeam: string | null;
  idAwayTeam: string | null;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
};

type TSDBList = { events?: TSDBEvent[] };
@Injectable({ providedIn: 'root' })
export class SportDbNewService {
    private http = inject(HttpClient);

  // Caché simple en memoria: key = `${season}:${round}`
  private roundCache = new Map<string, Match[]>();

  /** Devuelve la última jornada (cálculo con next/past) y sus partidos ya mapeados */
  getInitialRound(params: { leagueId: number | string; season: string; maxRounds?: number }):
    Observable<{ round: number; matches: Match[] }> {

    const { leagueId, season, maxRounds = 17 } = params;

    // 1) Intento A: próxima jornada → la última jugada es (min(next) - 1)
    const next$ = this.http.get<TSDBList>(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=${leagueId}`)
      .pipe(catchError(() => of({ events: [] } as TSDBList)));

    // 2) Intento B: últimos eventos → última jugada = max(intRound de “past”)
    const past$ = this.http.get<TSDBList>(`https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=${leagueId}`)
      .pipe(catchError(() => of({ events: [] } as TSDBList)));

    return forkJoin([next$, past$]).pipe(
      switchMap(([nextRes, pastRes]) => {
        const nextRounds = (nextRes.events ?? [])
          .map(e => this.safeInt(e.intRound))
          .filter(r => r > 0 && r <= maxRounds);
        const rNextMin = nextRounds.length ? Math.min(...nextRounds) : null;

        let latestRound: number | null = null;
        if (rNextMin && rNextMin > 1) {
          latestRound = rNextMin - 1;
        } else {
          const pastRounds = (pastRes.events ?? [])
            .map(e => this.safeInt(e.intRound))
            .filter(r => r > 0 && r <= maxRounds);
          latestRound = pastRounds.length ? Math.max(...pastRounds) : 1;
        }

        const round = latestRound ?? 1;
        return this.getRoundCached({ leagueId, season, round })
          .pipe(map(matches => ({ round, matches })));
      })
    );
  }

  /** Devuelve los partidos de una jornada (con caché) */
  getRoundCached(params: { leagueId: number | string; season: string; round: number }): Observable<Match[]> {
    const { leagueId, season, round } = params;
    const key = `${season}:${round}`;
    const cached = this.roundCache.get(key);
    if (cached) return of(cached);

    const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=${leagueId}&r=${round}&s=${encodeURIComponent(season)}`;
    return this.http.get<TSDBList>(url).pipe(
      map(res => this.mapEvents(res.events ?? [])),
      map(matches => {
        this.roundCache.set(key, matches);
        return matches;
      })
    );
  }

  // ============== MAPEO ==============

  private mapEvents(events: TSDBEvent[]): Match[] {
    // dedupe por idEvent por si el endpoint repite
    const byId = new Map<string, TSDBEvent>();
    for (const e of events) if (e?.idEvent) byId.set(e.idEvent, e);

    const list = Array.from(byId.values()).sort((a, b) => {
      const ra = this.safeInt(a.intRound), rb = this.safeInt(b.intRound);
      if (ra !== rb) return ra - rb;
      const da = a.dateEvent ?? a.dateEventLocal ?? '';
      const db = b.dateEvent ?? b.dateEventLocal ?? '';
      return da.localeCompare(db);
    });

    return list.map(ev => {
      const id = this.safeInt(ev.idEvent);
      const roundNum = this.safeInt(ev.intRound);
      const week = roundNum > 0 ? String(roundNum).padStart(2, '0') : '01';

      const dateISO = ev.dateEventLocal ?? ev.dateEvent ?? null;
      const timeISO = ev.strTimeLocal ?? ev.strTime ?? null;
      const { dateLabel, timeLabel } = this.formatDateTime(dateISO, timeISO);

      const homeTeam: Team = {
        id: this.safeInt(ev.idHomeTeam),
        name: ev.strHomeTeam ?? 'N/A',
        shortName: this.shorten(ev.strHomeTeam ?? 'N/A'),
        logoUrl: ev.strHomeTeamBadge ?? null,
        record: '—',
      };
      const awayTeam: Team = {
        id: this.safeInt(ev.idAwayTeam),
        name: ev.strAwayTeam ?? 'N/A',
        shortName: this.shorten(ev.strAwayTeam ?? 'N/A'),
        logoUrl: ev.strAwayTeamBadge ?? null,
        record: '—',
      };

      const homeScore = this.numOrNull(ev.intHomeScore);
      const awayScore = this.numOrNull(ev.intAwayScore);
      const finished = this.isFinished(ev.strStatus, homeScore, awayScore);

      return {
        id,
        week,
        date: dateLabel,
        time: timeLabel,
        status: finished ? 'FINISHED' : 'SCHEDULED',
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homeProb: finished ? undefined : 50,
        awayProb: finished ? undefined : 50,
      } as Match;
    });
  }

  // ============== HELPERS ==============
  private safeInt(v: string | number | null | undefined): number {
    if (v == null) return 0;
    return typeof v === 'number' ? v : (parseInt(v, 10) || 0);
    }
  private numOrNull(v: string | number | null): number | null {
    if (v === null || v === undefined || v === '') return null;
    return typeof v === 'number' ? v : (isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));
  }
  private isFinished(status: string | null | undefined, h: number | null, a: number | null): boolean {
    const s = (status ?? '').toLowerCase();
    return s.includes('finished') || s === 'ft' || (h !== null && a !== null);
  }
  private formatDateTime(dateISO: string | null, timeISO: string | null) {
    if (!dateISO) return { dateLabel: '—', timeLabel: '—' };
    const iso = `${dateISO}T${timeISO ?? '00:00:00'}`;
    const d = new Date(iso);
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dd = d.getDate().toString().padStart(2, '0');
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return { dateLabel: `${dd} ${months[d.getMonth()]}`, timeLabel: `${hh}:${mm}` };
  }
  private shorten(n: string) {
    return n.replace(/(Club|Club de Futbol|Futbol Club|Football Club|Deportivo)\s+/ig, '').trim();
  }
}
