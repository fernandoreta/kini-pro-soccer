import { ChangeDetectionStrategy, Component, computed, signal, inject, OnDestroy, OnInit } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { SupabaseClient, User, createClient } from '@supabase/supabase-js';
import { Match, SportDbNewService, Team } from './sports.servicenew.service';

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

const SUPABASE_URL = 'https://jhbzqsopzfgwcfevzhpe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoYnpxc29wemZnd2NmZXZ6aHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzE3NjYsImV4cCI6MjA3NzUwNzc2Nn0.cNznQyVXM4sC0RTAXj9RZIDAh7xR6HAERgd1HZk3vMk';
const AUTH_EMAIL_DOMAIN = 'auth.kini-pro.local';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
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
    `.header-user-area { display: flex; align-items: center; gap: 0.75rem; }`,
    `.auth-welcome { font-size: 0.875rem; color: #9ca3af; }`,
    `.auth-button { padding: 0.3rem 0.9rem; border-radius: 9999px; background-color: #2563eb; color: white; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; transition: background-color 200ms ease-in-out; }`,
    `.auth-button:hover:not(:disabled) { background-color: #1d4ed8; }`,
    `.auth-button:disabled { opacity: 0.6; cursor: not-allowed; }`,
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
    `.auth-modal-overlay { position: fixed; inset: 0; background-color: rgba(15, 23, 42, 0.85); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1.5rem; }`,
    `.auth-modal-card { position: relative; width: min(100%, 24rem); background-color: #111827; border: 1px solid #1f2937; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); display: flex; flex-direction: column; gap: 1rem; }`,
    `.auth-modal-close { position: absolute; top: 0.75rem; right: 0.75rem; background: transparent; border: none; color: #9ca3af; font-size: 1.25rem; cursor: pointer; }`,
    `.auth-modal-close:hover { color: #f3f4f6; }`,
    `.auth-modal-title { font-size: 1.25rem; font-weight: 700; color: #f9fafb; }`,
    `.auth-modal-toggle { font-size: 0.875rem; color: #9ca3af; }`,
    `.auth-modal-toggle button { background: none; border: none; color: #60a5fa; font-weight: 600; cursor: pointer; padding: 0; margin-left: 0.25rem; }`,
    `.auth-modal-toggle button:hover { color: #93c5fd; }`,
    `.auth-modal-form { display: flex; flex-direction: column; gap: 0.75rem; }`,
    `.auth-modal-form label { font-size: 0.875rem; color: #cbd5f5; display: flex; flex-direction: column; gap: 0.35rem; }`,
    `.auth-modal-form input { padding: 0.65rem 0.75rem; border-radius: 0.5rem; border: 1px solid #374151; background-color: #1f2937; color: #f9fafb; font-size: 0.95rem; }`,
    `.auth-modal-form input:focus { outline: 2px solid #2563eb; outline-offset: 2px; }`,
    `.auth-modal-form button[type="submit"] { margin-top: 0.5rem; background-color: #10b981; color: #0b1120; border: none; border-radius: 0.5rem; padding: 0.65rem; font-weight: 700; cursor: pointer; transition: background-color 200ms ease-in-out; }`,
    `.auth-modal-form button[type="submit"]:hover:not(:disabled) { background-color: #059669; }`,
    `.auth-modal-form button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }`,
    `.auth-modal-error { background-color: #7f1d1d; color: #fecaca; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; }`,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  private api = inject(SportDbNewService);
  private supabase?: SupabaseClient;
  private authStateSubscription?: { unsubscribe: () => void };
  private readonly supabaseConfigured = !!SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('COLOCA_TU_SUPABASE_ANON_KEY_AQUI');

  authUser = signal<User | null>(null);
  authModalOpen = signal(false);
  authMode = signal<'login' | 'register'>('login');
  authLoading = signal(false);
  authError = signal<string | null>(null);
  authUsername = '';
  authPassword = '';
  authDisplayName = computed(() => {
    const user = this.authUser();
    if (!user) return '';
    const metadataName = typeof user.user_metadata?.['username'] === 'string' ? user.user_metadata['username'] : '';
    if (metadataName) return metadataName;
    if (user.email) return user.email.split('@')[0];
    return 'Usuario';
  });

  constructor() {
    if (this.supabaseConfigured) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          storageKey: 'kini-pro-auth',
        },
      });
      void this.initializeAuth();
    } else {
      console.warn('Supabase no está configurado. Configura la clave anónima para habilitar autenticación.');
    }
  }

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
  readonly TOTAL_WEEKS = 17;
  weeks = computed(() => Array.from({ length: this.TOTAL_WEEKS }, (_, i) => i + 1));
  filteredMatches = computed(() => this.matches());

  // Footer nav items (faltaban)
  navItems: NavItem[] = [
    { label: 'Inicio', tab: 'HOME', path: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125a3 3 0 003 3h8.25a3 3 0 003-3V9.75M8.25 21.75h7.5' },
    { label: 'Picks',  tab: 'PICKEM', path: 'M9 12.75a3 3 0 116 0 3 3 0 01-6 0zM12 15a7.5 7.5 0 00-7.777 5.25c-.217.514.502.94 1.054.55L12 18.75l6.723 3.05a.75.75 0 001.054-.55A7.5 7.5 0 0012 15z' },
    { label: 'Perfil', tab: 'PROFILE', path: 'M17.982 7.525a1.5 1.5 0 10-.007 2.992 1.5 1.5 0 00.007-2.992zM12 17.25c-2.485 0-4.5-2.239-4.5-5s2.015-5 4.5-5 4.5 2.239 4.5 5-2.015 5-4.5 5z' },
  ];

  openAuthModal(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authError.set(null);
    this.authLoading.set(false);
    this.resetAuthForm();
    this.authModalOpen.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpen.set(false);
    this.authError.set(null);
    this.authLoading.set(false);
    this.resetAuthForm();
  }

  switchAuthMode(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authError.set(null);
    this.authLoading.set(false);
    this.resetAuthForm();
  }

  async submitAuth(): Promise<void> {
    if (!this.supabaseConfigured || !this.supabase) {
      this.authError.set('Configura las credenciales de Supabase antes de continuar.');
      return;
    }

    const username = this.authUsername.trim();
    const password = this.authPassword;

    if (!username || !password) {
      this.authError.set('Ingresa usuario y contraseña.');
      return;
    }

    if (password.length < 6) {
      this.authError.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);

    const email = this.mapUsernameToEmail(username);

    try {
      if (this.authMode() === 'login') {
        const { error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await this.supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });
        if (error) throw error;
        if (!data.user) {
          throw new Error('El registro no devolvió un usuario activo.');
        }
      }
      this.resetAuthForm();
      this.authModalOpen.set(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la autenticación.';
      this.authError.set(message);
    } finally {
      this.authLoading.set(false);
    }
  }

  async signOut(): Promise<void> {
    if (!this.supabaseConfigured || !this.supabase) {
      this.authUser.set(null);
      return;
    }

    this.authLoading.set(true);
    this.authError.set(null);
    setTimeout(() => {
      location.reload();
    }, 500);
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cerrar sesión.';
      this.authError.set(message);
    } finally {
      this.authLoading.set(false);
    }
  }

  private async initializeAuth(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase.auth.getSession();
      if (!error && data.session?.user) {
        this.authUser.set(data.session.user);
      }
    } catch (error) {
      console.error('No se pudo recuperar la sesión de Supabase', error);
    }

    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      this.authUser.set(session?.user ?? null);
    });

    // if (error) {
    //   console.error('No se pudo suscribir a los cambios de autenticación', error);
    //   return;
    // }

    this.authStateSubscription = data.subscription;
  }

  private resetAuthForm(): void {
    this.authUsername = '';
    this.authPassword = '';
  }

  private mapUsernameToEmail(username: string): string {
    const sanitized = username.trim().toLowerCase().replace(/\s+/g, '.');
    return `${sanitized}@${AUTH_EMAIL_DOMAIN}`;
  }

  ngOnInit(): void {
    const leagueId = 4350;
    const season = '2025-2026';

    this.api.getInitialRound({ leagueId, season, maxRounds: this.TOTAL_WEEKS })
      .subscribe(({ round, matches }) => {
        this.selectedWeek.set(round);
        this.matches.set(matches);
        // (Opcional) podrías inferir teams de los matches si quieres poblar logos globales
      });
  }

  ngOnDestroy(): void {
    this.authStateSubscription?.unsubscribe();
  }

  // Estado de la jornada seleccionada
  selectedWeekStatus = computed<MatchStatus>(() => {
    const weekStr = String(this.selectedWeek());
    const ms = this.matches().filter(m => m.week === weekStr);
    return (ms.length && ms.every(m => m.status === 'FINISHED')) ? 'FINISHED' : 'SCHEDULED';
  });

  selectWeek(week: number): void {
    if (week === this.selectedWeek()) return;
    this.selectedWeek.set(week);

    const leagueId = 4350;
    const season = '2025-2026';

    this.api.getRoundCached({ leagueId, season, round: week })
      .subscribe(matches => this.matches.set(matches));
  }


  // Navegación
  selectTab(tab: 'HOME' | 'PICKEM' | 'PROFILE'): void { this.activeTab.set(tab); }

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
