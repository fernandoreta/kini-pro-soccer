import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

// --- Interfaces para la Estructura de Datos ---
interface Team {
  id: number;
  name: string;
  shortName: string;
  logoUrl: string; // URL de imagen o placeholder
  record: string; // Puntos: G-E-P
}

interface Match {
  id: number;
  week: string;
  date: string;
  time: string;
  homeTeam: Team;
  awayTeam: Team;
  homeProb: number; // Probabilidad de ganar (0-100)
  awayProb: number; // Probabilidad de ganar (0-100)
}

interface UserPick {
  matchId: number;
  winnerId: number; // ID del equipo seleccionado
}

interface NavItem {
    label: string;
    path: string;
    tab: 'HOME' | 'PICKEM' | 'PROFILE';
}

// --- Componente Principal ---
@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div class="app-container">
      <!-- Encabezado Fijo -->
      <header class="header-fixed">
        <div class="header-top-bar">
          <div class="header-title">Liga MX Pick'Em</div>
          <div class="header-subtitle">Jornada {{ selectedWeek() }}</div>
        </div>
        <!-- Nota: Se eliminaron las pestañas del header, la navegación es ahora en el footer -->
      </header>

      <!-- Contenido Principal -->
      <main class="main-content">
        
        <!-- Vista INICIO -->
        @if (activeTab() === 'HOME') {
          <div class="content-section">
            <h2 class="section-title text-green-400">Inicio: Resumen de la Liga</h2>
            <div class="home-card">
                <p class="text-lg font-semibold mb-2">¡Bienvenido de vuelta!</p>
                <p class="text-gray-400 mb-4">El Clausura está que arde. Revisa tus pronósticos para la jornada actual y no te quedes fuera de la pelea.</p>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">Jornada {{ selectedWeek() }}</span>
                        <span class="stat-label">Actual</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value text-yellow-500">24/72</span>
                        <span class="stat-label">Partidos Totales</span>
                    </div>
                </div>

                <h3 class="section-subtitle">Últimas Noticias (Mock)</h3>
                <ul class="news-list">
                    <li><span class="text-green-400 font-bold">CRUZ AZUL:</span> Asegura el liderato con una victoria de último minuto.</li>
                    <li><span class="text-red-400 font-bold">AMÉRICA:</span> Empata en un clásico polémico.</li>
                    <li><span class="text-blue-400 font-bold">MONTERREY:</span> Su entrenador es baja por lesión.</li>
                </ul>
            </div>
          </div>
        }

        <!-- Vista PRONÓSTICOS (PICKEM) -->
        @if (activeTab() === 'PICKEM') {
          <div class="content-section">
            <!-- Selector de Jornada -->
            <div class="week-selector-scroll">
              @for (week of weeks(); track week) {
                <button 
                  (click)="selectWeek(week)"
                  [class.week-active]="selectedWeek() === week"
                  [class.week-inactive]="selectedWeek() !== week"
                  class="week-button"
                >
                  Jornada {{ week }}
                </button>
              }
            </div>

            <!-- Título de Próximos Partidos -->
            <h2 class="section-title">Próximos Partidos</h2>
            
            <!-- Lista de Partidos -->
            <div class="match-grid">
              @for (match of filteredMatches(); track match.id) {
                <div class="match-card">
                  <div class="match-info-top">
                    <span class="text-xs">{{ match.date }} | {{ match.time }}</span>
                    <!-- Indicador de pick -->
                    @if (isPicked(match.id)) {
                      <span class="pick-indicator">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                        </svg>
                        Elegido
                      </span>
                    }
                  </div>
                  
                  <!-- Contenedor del Partido -->
                  <div class="match-teams-container">
                    
                    <!-- Equipo Local -->
                    <div 
                      (click)="makePick(match.id, match.homeTeam.id)"
                      [class.pick-ring-active]="getPick(match.id) === match.homeTeam.id"
                      class="team-pick-area"
                    >
                      <div class="team-logo-placeholder">
                          {{ match.homeTeam.shortName.charAt(0) }}
                      </div>
                      <span class="team-prob">
                        {{ match.homeProb }}% prob.
                      </span>
                      <span class="team-name">{{ match.homeTeam.shortName }}</span>
                      <span class="team-record">{{ match.homeTeam.record }} Pts</span>
                    </div>

                    <!-- Separador / VS -->
                    <div class="match-vs-separator">VS</div>

                    <!-- Equipo Visitante -->
                    <div 
                      (click)="makePick(match.id, match.awayTeam.id)"
                      [class.pick-ring-active]="getPick(match.id) === match.awayTeam.id"
                      class="team-pick-area"
                    >
                      <div class="team-logo-placeholder">
                          {{ match.awayTeam.shortName.charAt(0) }}
                      </div>
                      <span class="team-prob">
                        {{ match.awayProb }}% prob.
                      </span>
                      <span class="team-name">{{ match.awayTeam.shortName }}</span>
                      <span class="team-record">{{ match.awayTeam.record }} Pts</span>
                    </div>

                  </div>
                  
                  <!-- Iconos de Interacción (Ojos y Billetes - Simulación) -->
                  <div class="match-interaction-bar">
                    <span class="match-interaction-item">
                      <!-- Ojo - Vistas -->
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 mr-1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.433 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {{ match.id * 3 + 12 }}.3K
                    </span>
                    <span class="match-interaction-item-highlight">
                      <!-- Fuego - Interacciones -->
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" class="w-5 h-5 mr-1">
                        <path d="M12 21.5c1.4 0 2.5-.5 3.5-1.5s1.5-2.2 1.5-3.5c0-1.2-.5-2.2-1.5-3.2s-2.2-1.5-3.5-1.5c-1.3 0-2.4.5-3.5 1.5s-1.5 2.2-1.5 3.5c0 1.2.5 2.2 1.5 3.2s2.2 1.5 3.5 1.5zm-5.7-10.7c.3-.5.7-1.1 1.2-1.6s1.1-.9 1.7-1.2c.5-.3 1.1-.5 1.7-.5.7 0 1.2.1 1.8.4.6.3 1.1.7 1.6 1.2.5.5.9 1.1 1.2 1.7.3.6.4 1.2.4 1.8 0 .7-.1 1.3-.4 1.9-.3.6-.7 1.1-1.2 1.6s-1.1.9-1.7 1.2c-.6.3-1.2.4-1.8.4-.7 0-1.3-.1-1.9-.4-.6-.3-1.1-.7-1.6-1.2-.5-.5-.9-1.1-1.2-1.7-.3-.6-.4-1.2-.4-1.8 0-.6.1-1.2.4-1.7zm13.1 3.5c-.3.6-.8 1.1-1.4 1.5s-1.4.6-2.2.6c-.8 0-1.6-.2-2.3-.6s-1.3-.9-1.8-1.5c-.5-.6-.8-1.3-.9-2.1-.1-.8 0-1.6.2-2.3.2-.7.6-1.4 1.1-2s1.1-1 1.8-1.4c.7-.4 1.4-.6 2.2-.6.8 0 1.5.2 2.2.6s1.3.9 1.8 1.5c.5.6.8 1.3.9 2.1.1.8 0 1.6-.2 2.3z"/>
                      </svg>
                      {{ match.id * 2 + 5 }}
                    </span>
                  </div>
                </div>
              }
              @if (filteredMatches().length === 0) {
                <p class="no-matches-text">
                  No hay partidos para la Jornada {{ selectedWeek() }}.
                </p>
              }
            </div>
          </div>
        }

        <!-- Vista PERFIL -->
        @if (activeTab() === 'PROFILE') {
          <div class="content-section">
            <div class="profile-card">
              <h2 class="section-title text-blue-400">Mi Perfil Pick'Em</h2>
              
              <div class="profile-header">
                <div class="profile-avatar">
                  {{ mockProfile.name.charAt(0) }}
                </div>
                <div class="profile-info">
                  <span class="profile-name">{{ mockProfile.name }}</span>
                  <span class="profile-rank">Ranking Global: #{{ mockProfile.ranking }}</span>
                </div>
              </div>

              <div class="stats-grid mt-4">
                <div class="stat-item bg-gray-700">
                    <span class="stat-value text-green-400">{{ successPercentage() }}%</span>
                    <span class="stat-label">Acierto Global</span>
                </div>
                <div class="stat-item bg-gray-700">
                    <span class="stat-value">{{ mockProfile.correctPicks }}/{{ mockProfile.totalPicks }}</span>
                    <span class="stat-label">Pronósticos Acertados</span>
                </div>
                <div class="stat-item bg-gray-700">
                    <span class="stat-value text-yellow-500">{{ mockProfile.winningStreak }}</span>
                    <span class="stat-label">Racha Ganadora</span>
                </div>
              </div>

              <h3 class="section-subtitle mt-6">Posiciones de mi Pool (Mock)</h3>
              <ul class="pool-list">
                  @for (user of mockStandings; track user.id) {
                      <li class="pool-list-item">
                          <span class="pool-list-rank">{{ user.rank }}. {{ user.name }}</span>
                          <span class="pool-list-score">{{ user.score }} pts</span>
                      </li>
                  }
              </ul>
            </div>
          </div>
        }
      </main>

      <!-- Footer de Navegación Fijo -->
      <footer class="footer-fixed">
        <nav class="footer-nav">
          @for (item of navItems; track item.label) {
            <a href="#" class="footer-nav-item"
                (click)="selectTab(item.tab)"
                [class.footer-nav-active]="activeTab() === item.tab"
                [class.footer-nav-inactive]="activeTab() !== item.tab">
                <!-- Icono SVG -->
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.path" />
                </svg>
                {{ item.label }}
            </a>
          }
        </nav>
      </footer>
    </div>
  `,
  styles: [
    // --- Estilos Básicos Globales ---
    `.app-container {
        min-height: 100vh;
        background-color: #0d1117; /* Fondo oscuro principal */
        color: white;
        font-family: 'Inter', sans-serif;
        display: flex;
        flex-direction: column;
    }`,
    
    // --- Header ---
    `.header-fixed {
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: #0d1117;
        box-shadow: 0 4px 6px -1px rgba(0, 0,0, 0.1);
    }`,
    `.header-top-bar {
        padding: 1rem;
        border-bottom: 1px solid #374151; /* gray-700 */
        display: flex;
        align-items: center;
        justify-content: space-between;
    }`,
    `.header-title {
        font-size: 1.25rem; /* xl */
        font-weight: bold;
    }`,
    `.header-subtitle {
        font-size: 0.875rem; /* sm */
        font-weight: 300; /* light */
        color: #9ca3af; /* gray-400 */
    }`,
    
    // --- Main Content ---
    `.main-content {
        flex-grow: 1;
        padding: 1rem;
        padding-bottom: 6rem; /* Espacio para el footer */
        overflow-y: auto;
    }`,
    `.content-section {
        display: flex;
        flex-direction: column;
        gap: 1.5rem; /* space-y-6 */
    }`,
    `.section-title {
        font-size: 1.25rem; /* xl */
        font-weight: 600; /* semibold */
        color: #e5e7eb; /* gray-200 */
        text-transform: uppercase;
        margin-bottom: 0.5rem;
    }`,
    `.section-subtitle {
        font-size: 1rem;
        font-weight: 600;
        color: #9ca3af;
        margin-bottom: 0.5rem;
    }`,
    
    // --- Week Selector (Jornada) ---
    `.week-selector-scroll {
        display: flex;
        gap: 0.75rem; /* space-x-3 */
        overflow-x: auto;
        padding-bottom: 0.5rem;
        /* Ocultar barra de scroll */
        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }`,
    `.week-selector-scroll::-webkit-scrollbar {
        display: none;
    }`,
    `.week-button {
        flex-shrink: 0;
        padding: 0.5rem 1rem;
        font-size: 0.875rem; /* sm */
        font-weight: 500; /* medium */
        border-radius: 9999px; /* full */
        transition-property: background-color;
        transition-duration: 200ms;
    }`,
    `.week-active {
        background-color: #059669; /* green-600 */
    }`,
    `.week-inactive {
        background-color: #374151; /* gray-700 */
    }`,

    // --- Match Cards ---
    `.match-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr)); /* 2 columnas en mobile */
        gap: 1rem; /* gap-4 */
    }`,
    /* Media Query para Tablet/Desktop (simulando sm: y lg:) */
    `@media (min-width: 640px) { /* sm */
        .match-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
    }`,
    `@media (min-width: 1024px) { /* lg */
        .match-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }`,
    `.match-card {
        background-color: #1c212a;
        padding: 0.75rem;
        border-radius: 0.75rem; /* xl */
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border: 1px solid #374151;
    }`,
    `.match-info-top {
        font-size: 0.875rem;
        font-weight: 500;
        color: #9ca3af;
        margin-bottom: 0.75rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }`,
    `.pick-indicator {
        font-size: 0.75rem;
        color: #4ade80; /* green-400 */
        display: flex;
        align-items: center;
    }`,
    
    // --- Teams and Pick Logic (Compactación) ---
    `.match-teams-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem; /* space-x-2 */
    }`,
    `.team-pick-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1 1 0%;
        min-width: 0; /* FIX: Permite que el elemento se comprima más allá de su contenido mínimo */
        padding: 0.5rem;
        transition: all 200ms ease-in-out;
        border-radius: 0.5rem; /* lg */
        cursor: pointer;
        border: 4px solid transparent; /* default ring transparent */
    }`,
    `.team-pick-area:hover {
        background-color: #1f2937; /* gray-800 */
    }`,
    `.pick-ring-active {
        border-color: #10b981; /* green-500 */
    }`,
    `.team-logo-placeholder {
        width: 2.5rem;
        height: 2.5rem;
        margin-bottom: 0.25rem; /* mb-1 */
        border-radius: 9999px; /* full */
        background-color: #4b5563; /* gray-600 */
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        font-weight: bold;
    }`,
    `.team-prob {
        font-size: 0.75rem; /* xs */
        font-weight: 500; /* medium */
        color: #d1d5db; /* gray-300 */
    }`,
    `.team-name {
        font-size: 0.75rem; /* Compactación */
        font-weight: 600; /* semibold */
        margin-top: 0.25rem;
        line-height: 1.1;
        text-align: center;
        overflow-wrap: break-word; /* FIX: Asegura que el texto largo se envuelva */
    }`,
    `.team-record {
        font-size: 0.625rem; /* Compactación */
        color: #6b7280; /* gray-500 */
        line-height: 1.1;
    }`,
    `.match-vs-separator {
        font-size: 0.875rem; /* sm */
        font-weight: bold;
        color: #6b7280;
        margin: 0 0.15rem;
    }`,
    
    // --- Interaction Bar ---
    `.match-interaction-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid #1f2937;
        font-size: 0.875rem;
        color: #9ca3af;
    }`,
    `.match-interaction-item, .match-interaction-item-highlight {
        display: flex;
        align-items: center;
        font-size: 0.75rem; /* Compactar esta fuente también */
    }`,
    `.match-interaction-item-highlight {
        color: #f59e0b; /* yellow-500 */
    }`,
    
    // --- HOME and PROFILE Styles (New) ---
    `.home-card, .profile-card {
        padding: 1rem;
        background-color: #1c212a;
        border-radius: 0.75rem;
        border: 1px solid #374151;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }`,
    `.profile-header {
        display: flex;
        align-items: center;
        margin-bottom: 1.5rem;
        border-bottom: 1px solid #1f2937;
        padding-bottom: 1rem;
    }`,
    `.profile-avatar {
        width: 4rem;
        height: 4rem;
        border-radius: 9999px;
        background-color: #059669; /* green-600 */
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: bold;
        color: white;
        flex-shrink: 0;
        margin-right: 1rem;
    }`,
    `.profile-info {
        display: flex;
        flex-direction: column;
    }`,
    `.profile-name {
        font-size: 1.5rem;
        font-weight: 700;
        color: #e5e7eb;
    }`,
    `.profile-rank {
        font-size: 0.875rem;
        color: #9ca3af;
        font-weight: 500;
    }`,
    `.stats-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.5rem;
        text-align: center;
    }`,
    `.stat-item {
        background-color: #151a21;
        padding: 0.75rem 0.5rem;
        border-radius: 0.5rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }`,
    `.stat-value {
        font-size: 1.125rem;
        font-weight: 700;
        color: #e5e7eb;
    }`,
    `.stat-label {
        font-size: 0.75rem;
        color: #9ca3af;
        margin-top: 0.25rem;
    }`,
    `.news-list {
        list-style: disc;
        margin-left: 1.5rem;
        color: #9ca3af;
        margin-top: 1rem;
    }`,
    `.news-list li {
        margin-bottom: 0.5rem;
    }`,
    
    // --- Pool/Standings View (Reutilizado en Perfil) ---
    `.pool-list {
        margin-top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem; /* space-y-2 */
    }`,
    `.pool-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background-color: #1f2937; /* gray-800 */
        border-radius: 0.5rem;
    }`,
    `.pool-list-rank {
        font-weight: bold;
        font-size: 1.125rem; /* lg */
        color: #a7f3d0; /* green-300 */
    }`,
    `.pool-list-score {
        font-size: 1.25rem; /* xl */
        font-family: monospace; /* font-mono */
    }`,
    `.no-matches-text {
        color: #9ca3af;
        text-align: center;
        padding-top: 2rem;
        padding-bottom: 2rem;
        grid-column: 1 / -1; /* spans all columns */
    }`,

    // --- Footer ---
    `.footer-fixed {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4rem; /* h-16 */
        background-color: #151a21;
        border-top: 1px solid #374151; /* gray-700 */
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
    }`,
    `.footer-nav {
        display: flex;
        height: 100%;
        justify-content: space-around;
        align-items: center;
    }`,
    `.footer-nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        font-size: 0.75rem; /* xs */
        font-weight: 500; /* medium */
        transition-property: color;
        transition-duration: 200ms;
        text-decoration: none; /* Quitamos el subrayado */
        flex: 1; /* Para distribuir equitativamente los 3 elementos */
    }`,
    `.footer-nav-active {
        color: #10b981; /* green-500 */
    }`,
    `.footer-nav-inactive {
        color: #9ca3af; /* gray-400 */
    }`,

  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // --- Estado de la Aplicación (Signals) ---
  activeTab = signal<'HOME' | 'PICKEM' | 'PROFILE'>('PICKEM'); // Tipo actualizado
  selectedWeek = signal<number>(1);
  userPicks = signal<UserPick[]>([]);
  
  // --- Datos Mock para la Liga MX ---
  mockTeams: Team[] = [
    { id: 1, name: 'Club América', shortName: 'AME', logoUrl: 'ame.png', record: '15: 4-3-1' },
    { id: 2, name: 'C. D. Guadalajara', shortName: 'CHI', logoUrl: 'chi.png', record: '12: 3-3-2' },
    { id: 3, name: 'Cruz Azul F. C.', shortName: 'CAZ', logoUrl: 'caz.png', record: '18: 5-3-0' },
    { id: 4, name: 'C. F. Monterrey', shortName: 'MTY', logoUrl: 'MTY', record: '19: 6-1-1' },
    { id: 5, name: 'C. Santos Laguna', shortName: 'SAN', logoUrl: 'san.png', record: '10: 2-4-2' },
    { id: 6, name: 'C. U. N. L.', shortName: 'TIG', logoUrl: 'tig.png', record: '14: 4-2-2' },
    { id: 7, name: 'Pumas U. N. A. M.', shortName: 'PUM', logoUrl: 'pum.png', record: '11: 3-2-3' },
    { id: 8, name: 'C. Atlético de San Luis', shortName: 'ASL', logoUrl: 'asl.png', record: '9: 2-3-3' },
  ];

  mockMatches: Match[] = [
    { id: 101, week: '1', date: 'Vie, 12/07', time: '7:00pm ESPN', homeTeam: this.mockTeams[0], awayTeam: this.mockTeams[4], homeProb: 65, awayProb: 35 },
    { id: 102, week: '1', date: 'Sab, 13/07', time: '5:00pm FOX', homeTeam: this.mockTeams[2], awayTeam: this.mockTeams[1], homeProb: 58, awayProb: 42 },
    { id: 103, week: '1', date: 'Sab, 13/07', time: '9:00pm TUDN', homeTeam: this.mockTeams[5], awayTeam: this.mockTeams[7], homeProb: 72, awayProb: 28 },
    { id: 104, week: '2', date: 'Vie, 19/07', time: '9:00pm TV Azteca', homeTeam: this.mockTeams[1], awayTeam: this.mockTeams[3], homeProb: 45, awayProb: 55 },
    { id: 105, week: '2', date: 'Dom, 21/07', time: '12:00pm TUDN', homeTeam: this.mockTeams[6], awayTeam: this.mockTeams[0], homeProb: 50, awayProb: 50 },
  ];
  
  // Mock para el ranking del Pool
  mockStandings = [
    { id: 1, name: 'Usuario 1 (Tú)', score: 38, rank: 1 },
    { id: 2, name: 'Jorge M.', score: 35, rank: 2 },
    { id: 3, name: 'Adriana G.', score: 32, rank: 3 },
    { id: 4, name: 'Raúl P.', score: 28, rank: 4 },
  ];
  
  // Mock para el Perfil Personal
  mockProfile = {
    name: 'Usuario Principal (Tú)',
    ranking: 1,
    totalPicks: 50,
    correctPicks: 38,
    winningStreak: 5
  };

  // Ítems de navegación del footer (reducidos)
  navItems: NavItem[] = [
    { label: 'Inicio', tab: 'HOME', path: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125a3 3 0 003 3h8.25a3 3 0 003-3V9.75M8.25 21.75h7.5' },
    { label: 'Picks', tab: 'PICKEM', path: 'M9 12.75a3 3 0 116 0 3 3 0 01-6 0zM12 15a7.5 7.5 0 00-7.777 5.25c-.217.514.502.94 1.054.55L12 18.75l6.723 3.05a.75.75 0 001.054-.55A7.5 7.5 0 0012 15z' },
    { label: 'Perfil', tab: 'PROFILE', path: 'M17.982 7.525a1.5 1.5 0 10-.007 2.992 1.5 1.5 0 00.007-2.992zM12 17.25c-2.485 0-4.5-2.239-4.5-5s2.015-5 4.5-5 4.5 2.239 4.5 5-2.015 5-4.5 5z' },
  ];

  // --- Funciones de Estado y Lógica ---

  // Obtener todas las semanas únicas
  weeks = computed(() => {
    return [...new Set(this.mockMatches.map(m => m.week))]
      .map(w => parseInt(w))
      .sort((a, b) => a - b);
  });
  
  // Calcular el porcentaje de acierto
  successPercentage = computed(() => {
      const p = this.mockProfile;
      return ((p.correctPicks / p.totalPicks) * 100).toFixed(1);
  });

  // Filtrar partidos por la semana seleccionada
  filteredMatches = computed(() => {
    const weekStr = this.selectedWeek().toString();
    return this.mockMatches.filter(match => match.week === weekStr);
  });

  selectTab(tab: 'HOME' | 'PICKEM' | 'PROFILE'): void {
    this.activeTab.set(tab);
  }

  selectWeek(week: number): void {
    this.selectedWeek.set(week);
  }
  
  // Función para guardar el pronóstico
  makePick(matchId: number, winnerId: number): void {
    this.userPicks.update(picks => {
      // 1. Quitar el pick anterior si existe
      const filteredPicks = picks.filter(p => p.matchId !== matchId);
      
      // 2. Agregar el nuevo pick (o no hacer nada si es un 'des-pick')
      const currentPick = picks.find(p => p.matchId === matchId);
      
      if (currentPick && currentPick.winnerId === winnerId) {
        // Deseleccionar (no agregar el nuevo pick)
        return filteredPicks;
      } else {
        // Agregar el nuevo pick
        return [...filteredPicks, { matchId, winnerId }];
      }
    });
  }
  
  // Función para obtener el pick del usuario para un partido específico
  getPick(matchId: number): number | undefined {
    return this.userPicks().find(p => p.matchId === matchId)?.winnerId;
  }
  
  // Función para verificar si un partido tiene un pick
  isPicked(matchId: number): boolean {
    return !!this.userPicks().find(p => p.matchId === matchId);
  }
}
