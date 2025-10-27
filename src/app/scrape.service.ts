import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

type MatchStatus = 'FINISHED' | 'SCHEDULED';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string;
  record: string;
}

export interface Match {
  id: number;     // usaremos el id del evento si aparece en el href; si no, generamos hash
  week: string;   // round: "1", "2", ...
  date: string;   // "12 Jul", "2025-07-12" (lo que venga en la tabla)
  time: string;   // vacío porque el HTML no lo trae aquí
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeProb: number;
  awayProb: number;
  homeScore?: number;
  awayScore?: number;
}

@Injectable({ providedIn: 'root' })
export class ScrapeService {
  private http = inject(HttpClient);

  /**
   * Lee la página HTML de temporada y devuelve teams+matches parseados.
   * Ejemplo de url: https://www.thesportsdb.com/season/4350-mexican-primera-league/2025-2026&all=1&view=
   */
  getSeasonFromHtml(url: string): Observable<{ teams: Team[]; matches: Match[] }> {
    return this.http.get(url, { responseType: 'text' }).pipe(
      map(html => {
        const dom = new DOMParser().parseFromString(html, 'text/html');
        const teams = this.parseTeams(dom);
        const matches = this.parseMatches(dom, teams);
        return { teams, matches };
      })
    );
  }

  // ---------------- parsers ----------------

  private parseTeams(doc: Document): Team[] {
    // Buscamos el bloque con el listado "Team 2025-2026 Scheduals"
    // Está en el aside izquierdo; contiguo a imágenes tiny + links &t=<id>-<slug>
    const leftCol = Array.from(doc.querySelectorAll('.col-sm-3, .col-md-3, .col-lg-3')).find(col =>
      /Team\s+20\d{2}-\d{4}\s+Scheduals/i.test(col.textContent || '')
    ) || doc.querySelector('.col-sm-3'); // fallback

    const teams: Team[] = [];
    if (!leftCol) return teams;

    // En ese bloque hay pares <img> (badge tiny) + <a href="/season/...&t=134206-cd-guadalajara">Nombre</a>
    const links = leftCol.querySelectorAll<HTMLAnchorElement>('a[href*="&t="]');
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      const name = (a.textContent || '').trim();
      const idMatch = href.match(/[?&]t=(\d+)-/i) || href.match(/&t=(\d+)-/i);
      const id = idMatch ? Number(idMatch[1]) : this.hash(name);

      // Buscar el <img> inmediatamente anterior (suele ser el badge tiny)
      let imgEl: HTMLImageElement | null = null;
      let n: Node | null = a.previousSibling;
      while (n && !imgEl) {
        if (n instanceof HTMLImageElement) imgEl = n;
        n = n.previousSibling;
      }

      const logo = imgEl?.getAttribute('src') || 'https://placehold.co/100x100/374151/FFF?text=N/A';
      teams.push({
        id,
        name,
        shortName: this.short(name),
        logoUrl: logo,
        record: '-'
      });
    });

    // Dedupe por id
    const mapById = new Map<number, Team>();
    teams.forEach(t => mapById.set(t.id, t));
    return Array.from(mapById.values());
  }

  private parseMatches(doc: Document, teams: Team[]): Match[] {
    // En el panel principal (col-sm-9) hay MUCHAS <table> cada una con un <tr> que contiene:
    // [td fecha] [td con link r=01] [td home link] [td score "2 - 3"] [td away link]
    const rightCol = doc.querySelector('.col-sm-9') || doc.body;
    const tables = rightCol.querySelectorAll('table');

    const teamIndex = new Map<string, Team>();
    for (const t of teams) {
      teamIndex.set(this.norm(t.name), t);
      teamIndex.set(this.norm(t.shortName), t);
    }

    const out: Match[] = [];
    tables.forEach(tbl => {
      const tr = tbl.querySelector('tr');
      if (!tr) return;

      const tds = tr.querySelectorAll('td');
      if (tds.length < 5) return;

      const dateTd = tds[0];
      const midTd  = tds[1]; // contiene link r=01 (round)
      const homeTd = tds[2];
      const scoreTd= tds[3];
      const awayTd = tds[4];

      const dateText = (dateTd.textContent || '').trim();          // "12 Jul"
      const roundLink = midTd.querySelector<HTMLAnchorElement>('a[href*="&r="], a[href*="/r="]');
      const round = roundLink ? (roundLink.textContent || '').replace(/^r/i,'').trim() : '';

      const homeA = homeTd.querySelector<HTMLAnchorElement>('a');
      const awayA = awayTd.querySelector<HTMLAnchorElement>('a');
      const homeName = (homeA?.textContent || '').trim();
      const awayName = (awayA?.textContent || '').trim();

      const eventHref = (homeA?.getAttribute('href') || '') || (awayA?.getAttribute('href') || '');
      const idEventMatch = eventHref.match(/\/event\/(\d+)-/i);
      const matchId = idEventMatch ? Number(idEventMatch[1]) : this.hash(`${dateText}|${homeName}|${awayName}|${round}`);

      const scoreText = (scoreTd.textContent || '').trim();        // "2 - 3" ó "" si no jugado
      const scoreParts = scoreText.split('-').map(s => s.trim());
      const homeScore = scoreParts.length === 2 && /^\d+$/.test(scoreParts[0]) ? Number(scoreParts[0]) : undefined;
      const awayScore = scoreParts.length === 2 && /^\d+$/.test(scoreParts[1]) ? Number(scoreParts[1]) : undefined;
      const finished: MatchStatus = (homeScore != null && awayScore != null) ? 'FINISHED' : 'SCHEDULED';

      const homeTeam = this.pickTeam(teamIndex, teams, homeName);
      const awayTeam = this.pickTeam(teamIndex, teams, awayName);

      out.push({
        id: matchId,
        week: round || '',     // "01"… -> si quieres: String(Number(round))
        date: dateText,
        time: '',              // no viene en esta vista
        status: finished,
        homeTeam,
        awayTeam,
        homeProb: 50,
        awayProb: 50,
        homeScore,
        awayScore
      });
    });

    // Ordena por round y día
    out.sort((a,b) => (Number(a.week)||0) - (Number(b.week)||0) || a.date.localeCompare(b.date));
    return out;
  }

  // ---------------- helpers ----------------

  private norm(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim();
  }

  private short(s: string): string {
    return this.norm(s).replace(/[^a-z0-9]/g,'').slice(0,3).toUpperCase() || s.slice(0,3).toUpperCase();
  }

  private pickTeam(index: Map<string, Team>, list: Team[], name: string): Team {
    const n = this.norm(name);
    return index.get(n) || list.find(t => this.norm(t.name) === n) || {
      id: this.hash(name),
      name,
      shortName: this.short(name),
      logoUrl: 'https://placehold.co/100x100/374151/FFF?text=N/A',
      record: '-'
    };
  }

  private hash(s: string): number {
    let h = 0;
    for (let i=0;i<s.length;i++) { h = (h<<5) - h + s.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
}
  