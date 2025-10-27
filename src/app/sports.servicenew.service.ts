// thesportsdb.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export type MatchStatus = 'FINISHED' | 'SCHEDULED';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string | null;
  record: string; // si no tienes standings, dejamos '—' o ''
}

export interface Match {
  id: number;
  week: string;                 // "01", "02", ...
  date: string;                 // "12 Jul"
  time: string;                 // "20:05"
  status: MatchStatus;          // FINISHED | SCHEDULED
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number | null;
  awayScore?: number | null;
  homeProb?: number;            // placeholder (si luego agregas odds)
  awayProb?: number;            // placeholder
}

type TSDBEvent = {
  idEvent: string;
  idLeague: string;
  strSeason: string;
  strEvent: string;
  strStatus: string;            // "Match Finished" | "Not Started" | etc
  intRound: string | number;    // jornada
  dateEvent: string | null;     // "2025-07-12"
  strTime: string | null;       // "03:05:00" (UTC)
  dateEventLocal: string | null;// "2025-07-11" (local)
  strTimeLocal: string | null;  // "20:05:00" (local)
  idHomeTeam: string | null;
  idAwayTeam: string | null;
  strHomeTeam: string | null;
  strAwayTeam: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strHomeTeamBadge?: string | null;
  strAwayTeamBadge?: string | null;
};

type TSDBSeasonResponse = {
  events?: TSDBEvent[];
};

@Injectable({ providedIn: 'root' })
export class SportDbNewService {
  private http = inject(HttpClient);

  /**
   * Puedes pasarle:
   *  - url completa (la que ya usas), o
   *  - params { leagueId, season } para que el servicio construya la URL
   */
  getSeason(
    urlOrParams: string | { leagueId: string | number; season: string } =
      'https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=4350&s=2025-2026'
  ): Observable<{ teams: Team[]; matches: Match[] }> {
    const url = typeof urlOrParams === 'string'
      ? urlOrParams
      : `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${urlOrParams.leagueId}&s=${encodeURIComponent(urlOrParams.season)}`;

    return this.http.get<TSDBSeasonResponse>(url).pipe(
      map(res => this.mapResponse(res))
    );
  }

  // =============== MAPEOS PRINCIPALES ===============

  private mapResponse(res: TSDBSeasonResponse): { teams: Team[]; matches: Match[] } {
    const events = (res.events ?? []).filter(Boolean);

    // Mapa de equipos deduplicados al vuelo
    const teamMap = new Map<number, Team>();

    const matches: Match[] = events.map(ev => {
      const id = this.toNum(ev.idEvent);
      const roundNum = this.toNum(ev.intRound);
      const week = roundNum > 0 ? String(roundNum).padStart(2, '0') : '01';

      // Fecha/hora: prioriza local si viene; si no, usa UTC
      const dateISO = ev.dateEventLocal ?? ev.dateEvent ?? null;
      const timeISO = ev.strTimeLocal ?? ev.strTime ?? null;

      const { dateLabel, timeLabel } = this.formatDateTime(dateISO, timeISO);

      const homeTeam: Team = {
        id: this.toNum(ev.idHomeTeam),
        name: ev.strHomeTeam ?? 'N/A',
        shortName: this.shortenName(ev.strHomeTeam ?? 'N/A'),
        logoUrl: ev.strHomeTeamBadge ?? null,
        record: '—',
      };
      const awayTeam: Team = {
        id: this.toNum(ev.idAwayTeam),
        name: ev.strAwayTeam ?? 'N/A',
        shortName: this.shortenName(ev.strAwayTeam ?? 'N/A'),
        logoUrl: ev.strAwayTeamBadge ?? null,
        record: '—',
      };

      // Guarda/actualiza en el mapa de equipos
      if (homeTeam.id) teamMap.set(homeTeam.id, homeTeam);
      if (awayTeam.id) teamMap.set(awayTeam.id, awayTeam);

      const homeScore = this.toNumNull(ev.intHomeScore);
      const awayScore = this.toNumNull(ev.intAwayScore);

      const status: MatchStatus = this.isFinished(ev.strStatus, homeScore, awayScore)
        ? 'FINISHED'
        : 'SCHEDULED';

      // Probabilidades placeholder si quieres mostrar algo previo
      const homeProb = status === 'SCHEDULED' ? 50 : undefined;
      const awayProb = status === 'SCHEDULED' ? 50 : undefined;

      const match: Match = {
        id,
        week,
        date: dateLabel,     // p.ej. "11 Jul"
        time: timeLabel,     // p.ej. "20:05"
        status,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        homeProb,
        awayProb,
      };

      return match;
    });

    const teams = [...teamMap.values()];
    return { teams, matches };
  }

  // =============== HELPERS ===============

  private toNum(v: string | number | null): number {
    if (v === null || v === undefined) return 0;
    return typeof v === 'number' ? v : parseInt(v, 10) || 0;
  }

  private toNumNull(v: string | number | null): number | null {
    if (v === null || v === undefined || v === '') return null;
    return typeof v === 'number' ? v : (isNaN(parseInt(v, 10)) ? null : parseInt(v, 10));
  }

  private isFinished(strStatus: string | null | undefined, home: number | null, away: number | null): boolean {
    const s = (strStatus ?? '').toLowerCase().trim();
    // TheSportsDB suele usar "Match Finished" cuando terminó
    if (s.includes('finished') || s === 'match finished' || s === 'ft') return true;
    // fallback: si hay scores numéricos en ambos lados
    if (home !== null && away !== null) return true;
    return false;
  }

  private shortenName(name: string): string {
    // Pequeña limpieza para mostrar nombres cortos bonitos
    return name
      .replace(/Futbol Club|Football Club|Club de Futbol|Club Deportivo|Club/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private formatDateTime(dateISO: string | null, timeISO: string | null): { dateLabel: string; timeLabel: string } {
    if (!dateISO) return { dateLabel: '—', timeLabel: '—' };

    // Construye fecha con el time si lo hay (para no movernos de día)
    const iso = timeISO ? `${dateISO}T${timeISO}` : `${dateISO}T00:00:00`;
    const d = new Date(iso);

    // "11 Jul"
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dd = d.getDate().toString().padStart(2, '0');
    const dateLabel = `${dd} ${months[d.getMonth()]}`;

    // "20:05"
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const timeLabel = `${hh}:${mm}`;

    return { dateLabel, timeLabel };
  }
}
