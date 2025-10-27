import { ChangeDetectionStrategy, Component, computed, signal, inject, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Match, Team, TsdbScrapeService } from './thesportsdb.service';

type MatchStatus = 'FINISHED' | 'SCHEDULED';

interface UserPick {
  matchId: number;
  winnerId: number;
}

interface NavItem {
  label: string;
  path: string;
  tab: 'HOME' | 'PICKEM' | 'PROFILE';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './template.html',
  styles: [
    `.app-container {
        min-height: 100vh;
        background-color: #0d1117;
        color: white;
        font-family: 'Inter', sans-serif;
        display: flex;
        flex-direction: column;
    }`,
    `.header-fixed {
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: #0d1117;
        box-shadow: 0 4px 6px -1px rgba(0, 0,0, 0.1);
    }`,
    `.header-top-bar {
        padding: 1rem;
        border-bottom: 1px solid #374151;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }`,
    `.header-title { font-size: 1.25rem; font-weight: bold; }`,
    `.header-subtitle { font-size: 0.875rem; font-weight: 300; color: #9ca3af; }`,
    `.main-content { flex-grow: 1; padding: 1rem; padding-bottom: 6rem; overflow-y: auto; }`,
    `.content-section { display: flex; flex-direction: column; gap: 1.5rem; }`,
    `.section-title { font-size: 1.25rem; font-weight: 600; color: #e5e7eb; text-transform: uppercase; margin-bottom: 0.5rem; }`,
    `.section-subtitle { font-size: 1rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.5rem; }`,
    `.week-selector-scroll { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; -ms-overflow-style: none; scrollbar-width: none; }`,
    `.week-selector-scroll::-webkit-scrollbar { display: none; }`,
    `.week-button { flex-shrink: 0; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; border-radius: 9999px; transition-property: background-color; transition-duration: 200ms; cursor: pointer; }`,
    `.week-active { background-color: #059669; }`,
    `.week-inactive { background-color: #374151; }`,
    `.match-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }`,
    `@media (min-width: 640px) { .match-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`,
    `@media (min-width: 1024px) { .match-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }`,
    `.match-card { background-color: #1c212a; padding: 0.75rem; border-radius: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); border: 1px solid #374151; }`,
    `.match-info-top { font-size: 0.875rem; font-weight: 500; color: #9ca3af; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }`,
    `.pick-indicator { font-size: 0.75rem; color: #4ade80; display: flex; align-items: center; }`,
    `.pick-indicator-missed { font-size: 0.75rem; color: #fca5a5; display: flex; align-items: center; }`,
    `.match-teams-container { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }`,
    `.team-pick-area { display: flex; flex-direction: column; align-items: center; flex: 1 1 0%; min-width: 0; padding: 0.5rem; transition: all 200ms ease-in-out; border-radius: 0.5rem; cursor: pointer; border: 4px solid transparent; }`,
    `.team-pick-area:hover:not(.cursor-not-allowed) { background-color: #1f2937; }`,
    `.cursor-not-allowed { cursor: not-allowed !important; }`,
    `.pick-ring-active { border-color: #10b981; }`,
    `.team-logo { width: 2.5rem; height: 2.5rem; margin-bottom: 0.25rem; border-radius: 9999px; object-fit: cover; border: 2px solid #4b5563; }`,
    `.match-score { font-size: 1.5rem; font-weight: 700; color: #9ca3af; margin-top: 0.25rem; line-height: 1.1; }`,
    `.score-winner { color: #4ade80; }`,
    `.team-prob { font-size: 0.75rem; font-weight: 500; color: #d1d5db; }`,
    `.team-name { font-size: 0.75rem; font-weight: 600; margin-top: 0.25rem; line-height: 1.1; text-align: center; overflow-wrap: break-word; }`,
    `.team-record { font-size: 0.625rem; color: #6b7280; line-height: 1.1; }`,
    `.match-vs-separator { font-size: 0.875rem; font-weight: bold; color: #6b7280; margin: 0 0.15rem; }`,
    `.match-interaction-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #1f2937; font-size: 0.875rem; color: #9ca3af; }`,
    `.match-interaction-item, .match-interaction-item-highlight { display: flex; align-items: center; font-size: 0.75rem; }`,
    `.match-interaction-item-highlight { color: #f59e0b; }`,
    `.home-card, .profile-card { padding: 1rem; background-color: #1c212a; border-radius: 0.75rem; border: 1px solid #374151; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }`,
    `.profile-header { display: flex; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid #1f2937; padding-bottom: 1rem; }`,
    `.profile-avatar { width: 4rem; height: 4rem; border-radius: 9999px; background-color: #059669; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: white; flex-shrink: 0; margin-right: 1rem; }`,
    `.profile-info { display: flex; flex-direction: column; }`,
    `.profile-name { font-size: 1.5rem; font-weight: 700; color: #e5e7eb; }`,
    `.profile-rank { font-size: 0.875rem; color: #9ca3af; font-weight: 500; }`,
    `.stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; text-align: center; }`,
    `.stat-item { background-color: #151a21; padding: 0.75rem 0.5rem; border-radius: 0.5rem; display: flex; flex-direction: column; justify-content: center; }`,
    `.stat-value { font-size: 1.125rem; font-weight: 700; color: #e5e7eb; }`,
    `.stat-label { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }`,
    `.news-list { list-style: disc; margin-left: 1.5rem; color: #9ca3af; margin-top: 1rem; }`,
    `.news-list li { margin-bottom: 0.5rem; }`,
    `.pool-list { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; }`,
    `.pool-list-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background-color: #1f2937; border-radius: 0.5rem; }`,
    `.pool-list-rank { font-weight: bold; font-size: 1.125rem; color: #a7f3d0; }`,
    `.pool-list-score { font-size: 1.25rem; font-family: monospace; }`,
    `.no-matches-text { color: #9ca3af; text-align: center; padding-top: 2rem; padding-bottom: 2rem; grid-column: 1 / -1; }`,
    `.footer-fixed { position: fixed; bottom: 0; left: 0; right: 0; height: 4rem; background-color: #151a21; border-top: 1px solid #374151; box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1); }`,
    `.footer-nav { display: flex; height: 100%; justify-content: space-around; align-items: center; }`,
    `.footer-nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem; font-size: 0.75rem; font-weight: 500; transition-property: color; transition-duration: 200ms; text-decoration: none; flex: 1; }`,
    `.footer-nav-active { color: #10b981; }`,
    `.footer-nav-inactive { color: #9ca3af; }`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private api = inject(TsdbScrapeService);

  // Estado UI
  activeTab = signal<'HOME' | 'PICKEM' | 'PROFILE'>('PICKEM');
  selectedWeek = signal<number>(1);

  // Picks
  userPicks = signal<UserPick[]>([]);

  // Data desde API
  teams = signal<Team[]>([]);
  matches = signal<Match[]>([]);

  // Mock para Perfil y Standings (para no romper tu template)
  mockStandings = [
    { id: 1, name: 'Usuario 1 (Tú)', score: 38, rank: 1 },
    { id: 2, name: 'Jorge M.', score: 35, rank: 2 },
    { id: 3, name: 'Adriana G.', score: 32, rank: 3 },
    { id: 4, name: 'Raúl P.', score: 28, rank: 4 },
  ];
  mockProfile = {
    name: 'Usuario Principal (Tú)',
    ranking: 1,
    totalPicks: 50,
    correctPicks: 38,
    winningStreak: 5
  };

  // Footer nav items (faltaban)
  navItems: NavItem[] = [
    { label: 'Inicio', tab: 'HOME', path: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125a3 3 0 003 3h8.25a3 3 0 003-3V9.75M8.25 21.75h7.5' },
    { label: 'Picks',  tab: 'PICKEM', path: 'M9 12.75a3 3 0 116 0 3 3 0 01-6 0zM12 15a7.5 7.5 0 00-7.777 5.25c-.217.514.502.94 1.054.55L12 18.75l6.723 3.05a.75.75 0 001.054-.55A7.5 7.5 0 0012 15z' },
    { label: 'Perfil', tab: 'PROFILE', path: 'M17.982 7.525a1.5 1.5 0 10-.007 2.992 1.5 1.5 0 00.007-2.992zM12 17.25c-2.485 0-4.5-2.239-4.5-5s2.015-5 4.5-5 4.5 2.239 4.5 5-2.015 5-4.5 5z' },
  ];

ngOnInit(): void {
  const url = 'https://www.thesportsdb.com/season/4350-mexican-primera-league/2025-2026&all=1&view=';

  this.api.getSeasonFromHtml(url).subscribe(({ teams, matches }) => {
    this.teams.set(teams);

    // 🔧 Normaliza: deja week como "01", "02", ... (solo dígitos, 2 chars)
    const normalizedMatches = matches.map(m => {
      const raw = String(m.week ?? '').trim();
      const onlyDigits = raw.replace(/\D/g, '');     // quita TODO lo que no sea dígito (r/R, espacios, etc.)
      const wk = onlyDigits.padStart(2, '0');        // "1" -> "01"
      return { ...m, week: wk };
    });

    // ⬇️ IMPORTANTE: setear los NORMALIZADOS
    this.matches.set(normalizedMatches);

    // 🧮 Semanas únicas limpias (sin "r")
    const uniqueWeeks = [...new Set(normalizedMatches.map(m => m.week))].sort();

    // 🔹 Jornada inicial (la primera disponible)
    const auto = this.pickAutoWeek(normalizedMatches, '2025-2026');
    this.selectedWeek.set(parseInt(auto) + 1);
  });
}



  // Semanas únicas
  weeks = computed(() => {
    return [...new Set(this.matches().map(m => Number(m.week)))].sort((a, b) => a - b);
  });

  // Estado de la jornada seleccionada
  selectedWeekStatus = computed<MatchStatus>(() => {
    const weekStr = String(this.selectedWeek());
    const ms = this.matches().filter(m => m.week === weekStr);
    return (ms.length && ms.every(m => m.status === 'FINISHED')) ? 'FINISHED' : 'SCHEDULED';
  });

  // Partidos filtrados por semana
  filteredMatches = computed(() => {
    const ws = String(this.selectedWeek()).padStart(2, '0'); // "1" -> "01"
    return this.matches().filter(m => String(m.week).padStart(2, '0') === ws);
  });

  // Navegación
  selectTab(tab: 'HOME' | 'PICKEM' | 'PROFILE'): void { this.activeTab.set(tab); }
  selectWeek(week: number): void { this.selectedWeek.set(week); }

  // Picks
  makePick(matchId: number, winnerId: number): void {
    this.userPicks.update(picks => {
      const match = this.matches().find(m => m.id === matchId);
      if (match && match.status === 'FINISHED') return picks;

      const filtered = picks.filter(p => p.matchId !== matchId);
      const current = picks.find(p => p.matchId === matchId);
      return (current && current.winnerId === winnerId)
        ? filtered
        : [...filtered, { matchId, winnerId }];
    });
  }
  getPick(matchId: number): number | undefined {
    return this.userPicks().find(p => p.matchId === matchId)?.winnerId;
  }
  isPicked(matchId: number): boolean {
    return !!this.userPicks().find(p => p.matchId === matchId);
  }

  //utils
  inferYearForMonth(monthIdx: number, season: string): number {
  // season "2025-2026" → start=2025, end=2026
  const [y1, y2] = season.split('-').map(n => parseInt(n, 10));
  // Liga MX (apertura/clausura) → meses 0..5 (Ene–Jun) usan y2; 6..11 (Jul–Dic) usan y1
  return monthIdx <= 5 ? y2 : y1;
}

MONTHS: Record<string, number> = {
  ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, sep:8, oct:9, nov:10, dic:11,
  jan:0, febr:1, marz:2, apr:3, may_:4, jun_:5, jul_:6, aug:7, sept:8, oct_:9, nov_:10, dec:11
};

parseDayMonth(dateText: string, season = '2025-2026'): Date | null {
  // Acepta "12 Jul", "01 Nov", con o sin acento/caso
  const m = dateText.trim().toLowerCase().match(/^(\d{1,2})\s+([a-záéíóú\.]+)$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monAbbr = m[2].slice(0,3).normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const monthIdx =
    monAbbr === 'may' ? 4 :
    monAbbr === 'jun' ? 5 :
    monAbbr === 'jul' ? 6 :
    monAbbr === 'aug' || monAbbr === 'ago' ? 7 :
    monAbbr === 'sep' ? 8 :
    monAbbr === 'oct' ? 9 :
    monAbbr === 'nov' ? 10 :
    monAbbr === 'dec' || monAbbr === 'dic' ? 11 :
    monAbbr === 'ene' ? 0 :
    monAbbr === 'feb' ? 1 :
    monAbbr === 'mar' ? 2 :
    monAbbr === 'abr' ? 3 :
    -1;

  if (monthIdx < 0) return null;
  const year = this.inferYearForMonth(monthIdx, season);
  return new Date(year, monthIdx, day);
}

pickAutoWeek(matches: { week: string; date: string; status: 'FINISHED' | 'SCHEDULED' }[], season = '2025-2026'): string {
  if (!matches.length) return '01';

  // Agrupa por semana
  const byWeek = new Map<string, { dates: Date[]; allFinished: boolean }>();
  for (const m of matches) {
    const w = m.week;
    const d = this.parseDayMonth(m.date, season);
    const entry = byWeek.get(w) ?? { dates: [], allFinished: true };
    if (d) entry.dates.push(d);
    if (m.status !== 'FINISHED') entry.allFinished = false;
    byWeek.set(w, entry);
  }

  // Ordena semanas como strings "01" < "02" < ...
  const weeks = [...byWeek.keys()].sort();

  // Métricas por semana
  const meta = weeks.map(w => {
    const { dates, allFinished } = byWeek.get(w)!;
    const min = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const max = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    return { w, min, max, allFinished };
  });

  const today = new Date();

  // 1) primera futura (min > hoy)
  const firstFuture = meta.find(x => x.min && x.min > today);
  if (firstFuture) {
    const idx = weeks.indexOf(firstFuture.w);
    return weeks[idx - 1] ?? firstFuture.w;
  }

  // 2) primera no completada
  const firstNotDone = meta.find(x => !x.allFinished);
  if (firstNotDone) return firstNotDone.w;

  // 3) última completada
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (meta[i].allFinished) return weeks[i];
  }

  // 4) fallback
  return weeks[0];
}


}
