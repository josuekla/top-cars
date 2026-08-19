import { ALL_CARS, type CarId, type CarStats } from '../core';
import type { AIDifficulty, RaceMode } from '../race';
import { soundSystem } from '../audio';
import { ALL_TRACKS, type TrackDefinition, type TrackId } from '../track';
import { CarShowcase } from '../render/showcase';
import { MultiplayerClient } from '../multiplayer/client';
import type { NetworkPlayerInfo } from '../multiplayer/protocol';

export interface MenuStartOptions {
  mode: RaceMode | 'multiplayer';
  carId: CarId;
  trackId?: TrackId;
  trackDefinition?: TrackDefinition;
  difficulty: AIDifficulty;
  multiplayerClient?: MultiplayerClient;
  networkPlayers?: NetworkPlayerInfo[];
}

export type MenuTab = 'main' | 'presentation' | 'credits' | 'multiplayer';

export class MenuSystem {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private onStartCallback?: (options: MenuStartOptions) => void;

  private selectedMode: RaceMode = 'race';
  private selectedCarIndex: number = 0;
  private selectedTrackIndex: number = 0;
  private selectedDifficulty: AIDifficulty = 'pro';
  private isVisible: boolean = false;
  private currentTab: MenuTab = 'main';

  private playerName: string = 'Piloto';

  private carShowcase: CarShowcase | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  // Multiplayer
  public mpClient: MultiplayerClient = new MultiplayerClient();
  private isMpReady: boolean = false;
  public networkPlayers: NetworkPlayerInfo[] = [];

  constructor(container: HTMLElement, onStart?: (options: MenuStartOptions) => void) {
    this.container = container;
    this.onStartCallback = onStart;

    if (typeof localStorage !== 'undefined') {
      const savedName = localStorage.getItem('topgear_player_name');
      if (savedName && savedName.trim()) {
        this.playerName = savedName.trim();
      }
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'retro-menu-overlay';
    this.setupLayout();
    this.container.appendChild(this.overlay);

    this.init3DShowcase();
    this.setupMultiplayerListeners();
    window.addEventListener('keydown', this.handleKeyDown);
  }

  public checkUrlForRoomJoin(): boolean {
    const roomCode = MultiplayerClient.parseRoomFromUrl();
    if (roomCode) {
      this.joinRoomByCode(roomCode);
      return true;
    }
    return false;
  }

  private setupLayout(): void {
    this.overlay.innerHTML = `
      <style>
        #retro-menu-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 15%, rgba(18, 26, 44, 0.97) 0%, rgba(6, 10, 18, 0.99) 100%);
          backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          color: #f8fafc;
          z-index: 999;
          user-select: none;
          overflow-y: auto;
          padding: 24px 16px;
        }

        /* CABEÇALHO BRANDING */
        .brand-header {
          text-align: center;
          margin-bottom: 16px;
        }

        .brand-title-wrap {
          display: inline-flex;
          align-items: baseline;
          gap: 10px;
          position: relative;
        }

        .brand-title-main {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #ffffff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
          margin: 0;
        }

        .brand-title-accent {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 34px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #f59e0b;
          text-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
        }

        .brand-subtitle-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          letter-spacing: 2px;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 20px;
          padding: 3px 12px;
          margin-top: 4px;
          font-weight: 700;
          text-transform: uppercase;
        }

        /* CARD PRINCIPAL UNIFICADO EM 2 COLUNAS */
        .unified-studio-card {
          background: rgba(13, 19, 33, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          width: 96%;
          max-width: 920px;
          box-shadow: 0 24px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.04);
          position: relative;
          z-index: 1001;
          backdrop-filter: blur(16px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* BARRA SUPERIOR DE ABAS */
        .studio-top-nav {
          display: flex;
          background: rgba(8, 12, 22, 0.6);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 12px;
          gap: 6px;
        }

        .nav-tab-pill {
          background: transparent;
          color: #94a3b8;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 8px 16px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .nav-tab-pill:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.04);
        }

        .nav-tab-pill.active {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.35);
        }

        .nav-tab-pill.pill-mp.active {
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.35);
        }

        /* CORPO EM GRID BENTO (2 COLUNAS) */
        .studio-grid-body {
          display: grid;
          grid-template-columns: 360px 1fr;
          min-height: 440px;
        }

        @media (max-width: 820px) {
          .studio-grid-body {
            grid-template-columns: 1fr;
          }
        }

        /* COLUNA ESQUERDA: GARAGEM & SHOWCASE 3D */
        .garage-column {
          padding: 18px;
          background: rgba(10, 15, 27, 0.5);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        @media (max-width: 820px) {
          .garage-column {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }
        }

        .showcase-viewport {
          background: radial-gradient(circle at 50% 60%, rgba(30, 41, 59, 0.6) 0%, rgba(10, 14, 26, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.4);
        }

        #menu-car-canvas {
          width: 100%;
          height: 180px;
          display: block;
        }

        .car-selector-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(8, 12, 22, 0.7);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .car-arrow-btn {
          background: rgba(30, 41, 59, 0.8);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 13px;
        }

        .car-arrow-btn:hover {
          background: rgba(51, 65, 85, 1);
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .car-brand-tag {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          text-align: center;
        }

        .car-desc-label {
          font-size: 10px;
          color: #94a3b8;
          text-align: center;
          margin-top: 2px;
          font-style: italic;
        }

        /* TELEMETRIA DO CARRO */
        .telemetry-box {
          background: rgba(8, 12, 22, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 10px 12px;
        }

        .telemetry-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .telemetry-row:last-child {
          margin-bottom: 0;
        }

        .telemetry-label {
          color: #94a3b8;
          font-weight: 600;
        }

        .telemetry-bar-bg {
          width: 55%;
          height: 6px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 3px;
          overflow: hidden;
        }

        .telemetry-bar-fill {
          height: 100%;
          border-radius: 3px;
          background: #38bdf8;
          transition: width 0.3s ease;
        }

        /* DOSSIÊ DO PILOTO (NOME) */
        .pilot-dossier-box {
          background: rgba(8, 12, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pilot-dossier-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #38bdf8;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          outline: none;
        }

        .pilot-dossier-input::placeholder {
          color: #64748b;
        }

        /* COLUNA DIREITA: DECK DE CONTROLE & ABAS */
        .control-column {
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .deck-section-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #94a3b8;
          font-weight: 800;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* CONTROLES DE CIRCUITO / MODO SINGLE PLAYER */
        .track-card {
          background: rgba(8, 12, 22, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .tab-btn-group {
          display: flex;
          gap: 6px;
          margin-bottom: 14px;
        }

        .sub-tab-btn {
          flex: 1;
          background: rgba(30, 41, 59, 0.5);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px 10px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .sub-tab-btn:hover {
          background: rgba(51, 65, 85, 0.7);
          color: #fff;
        }

        .sub-tab-btn.active {
          background: #f59e0b;
          color: #0f172a;
          border-color: #fbbf24;
          font-weight: 800;
        }

        .btn-launch-solo {
          width: 100%;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 14px 20px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
        }

        .btn-launch-solo:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
          background: linear-gradient(135deg, #34d399 0%, #059669 100%);
        }

        /* PAINEL MULTIPLAYER PADDOCK */
        .mp-connect-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        @media (max-width: 600px) {
          .mp-connect-grid {
            grid-template-columns: 1fr;
          }
        }

        .mp-action-card {
          background: rgba(8, 12, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
        }

        .mp-btn-host {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .mp-btn-host:hover {
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
          transform: translateY(-1px);
        }

        .mp-join-row {
          display: flex;
          gap: 6px;
        }

        .mp-code-input {
          flex: 1;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 10px;
          color: #f59e0b;
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 2px;
          text-align: center;
          outline: none;
        }

        .mp-code-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
        }

        .mp-btn-join {
          background: rgba(30, 41, 59, 0.9);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 8px;
          padding: 8px 14px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mp-btn-join:hover {
          background: rgba(56, 189, 248, 0.15);
          border-color: #38bdf8;
        }

        /* CARD DE SESSÃO ATIVA MULTIPLAYER */
        .mp-active-session-card {
          background: rgba(8, 12, 22, 0.7);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mp-session-code-badge {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 15px;
          font-weight: 900;
          color: #f59e0b;
          letter-spacing: 2px;
        }

        .mp-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
        }

        .status-led {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .status-led.connected { background: #10b981; box-shadow: 0 0 6px #10b981; }
        .status-led.connecting { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
        .status-led.disconnected { background: #64748b; }
        .status-led.failed { background: #ef4444; }

        .btn-copy-link {
          background: rgba(30, 41, 59, 0.8);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 6px;
          padding: 6px 12px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .btn-copy-link:hover {
          background: rgba(56, 189, 248, 0.15);
        }

        /* GRID DE SLOTS DE PILOTOS */
        .pilots-roster {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .pilot-slot-card {
          background: rgba(10, 15, 27, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .pilot-slot-card.is-you {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(14, 165, 233, 0.06);
        }

        .pilot-meta-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pilot-name-title {
          font-size: 13px;
          font-weight: 800;
          color: #f8fafc;
        }

        .badge-micro {
          font-size: 8px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-left: 4px;
        }

        .badge-you { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
        .badge-host { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }

        .badge-car-livery {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 10px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pilot-state-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 6px;
        }

        .pilot-state-badge.ready {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pilot-state-badge.waiting {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .pilot-slot-waiting {
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          background: rgba(10, 15, 27, 0.3);
        }

        /* BOTÕES DE LOBBY / AÇÃO */
        .mp-actions-row {
          display: flex;
          gap: 10px;
        }

        .btn-mp-toggle-ready {
          flex: 1;
          background: rgba(30, 41, 59, 0.8);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 12px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-mp-toggle-ready.is-ready {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-color: #10b981;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
        }

        .btn-mp-start-race {
          flex: 1;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.5px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-mp-start-race:disabled {
          background: rgba(51, 65, 85, 0.4);
          color: #64748b;
          box-shadow: none;
          cursor: not-allowed;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .btn-exit-subtab {
          background: transparent;
          color: #94a3b8;
          border: none;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
          text-align: center;
          transition: color 0.15s;
        }

        .btn-exit-subtab:hover {
          color: #f8fafc;
          text-decoration: underline;
        }

        /* ESTILO EDITORIAL PARA APRESENTAÇÃO E CRÉDITOS */
        .editorial-container {
          padding: 8px 4px;
          line-height: 1.6;
        }
      </style>

      <!-- CABEÇALHO -->
      <div class="brand-header">
        <div class="brand-title-wrap">
          <span class="brand-title-main">TOP GEAR</span>
          <span class="brand-title-accent">LEGADO</span>
        </div>
        <div>
          <span class="brand-subtitle-pill">⚡ 16-BIT ARCADE • LOW-LATENCY 60HZ</span>
        </div>
      </div>

      <!-- CARD PRINCIPAL EM 2 COLUNAS -->
      <div class="unified-studio-card">
        <!-- BARRA SUPERIOR DE NAVEGAÇÃO -->
        <div class="studio-top-nav">
          <button class="nav-tab-pill active" id="tab-nav-main">🏎️ MODO SOLO</button>
          <button class="nav-tab-pill pill-mp" id="tab-nav-multiplayer">🌐 MULTIPLAYER PADDOCK</button>
          <button class="nav-tab-pill" id="tab-nav-presentation">📖 MANUAL</button>
          <button class="nav-tab-pill" id="tab-nav-credits">🏆 CRÉDITOS</button>
        </div>

        <div class="studio-grid-body">
          <!-- COLUNA ESQUERDA: GARAGEM, SHOWCASE 3D & PERFIL DO PILOTO -->
          <div class="garage-column">
            <div class="deck-section-title">🏎️ Garagem & Máquina</div>
            
            <div class="showcase-viewport">
              <canvas id="menu-car-canvas"></canvas>
              <div class="car-selector-strip">
                <button class="car-arrow-btn" id="btn-prev-car" aria-label="Veículo anterior">◀</button>
                <div style="text-align: center;">
                  <div id="menu-car-badge" class="car-brand-tag" style="color: #e74c3c;">CANNIBAL</div>
                  <div id="menu-car-desc" class="car-desc-label">Foguete em retas com alto consumo</div>
                </div>
                <button class="car-arrow-btn" id="btn-next-car" aria-label="Próximo veículo">▶</button>
              </div>
            </div>

            <!-- TELEMETRIA DE ESPECIFICAÇÕES -->
            <div class="telemetry-box">
              <div class="telemetry-row">
                <span class="telemetry-label">Velocidade Máxima</span>
                <div class="telemetry-bar-bg"><div id="stat-speed" class="telemetry-bar-fill" style="width: 90%;"></div></div>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">Aceleração</span>
                <div class="telemetry-bar-bg"><div id="stat-accel" class="telemetry-bar-fill" style="width: 75%;"></div></div>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">Aderência / Curvas</span>
                <div class="telemetry-bar-bg"><div id="stat-handling" class="telemetry-bar-fill" style="width: 65%;"></div></div>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">Eficiência de Tanque</span>
                <div class="telemetry-bar-bg"><div id="stat-fuel" class="telemetry-bar-fill" style="width: 45%;"></div></div>
              </div>
            </div>

            <!-- DOSSIÊ DO PILOTO -->
            <div class="pilot-dossier-box">
              <span style="font-size: 16px;">👤</span>
              <div style="flex: 1;">
                <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Piloto do Grid</div>
                <input type="text" id="input-player-name" class="pilot-dossier-input" placeholder="Seu apelido..." maxlength="16" />
              </div>
            </div>
          </div>

          <!-- COLUNA DIREITA: CONTEÚDO DA ABA SELECIONADA -->
          <div class="control-column">
            <!-- ABA 1: MODO SOLO (PRINCIPAL) -->
            <div id="tab-content-main" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
              <div>
                <!-- Seletor de Modo de Prova -->
                <div class="deck-section-title">🏁 Modo de Prova</div>
                <div class="tab-btn-group" id="group-mode">
                  <button class="sub-tab-btn active" data-mode="race">Corrida (Grid com IA)</button>
                  <button class="sub-tab-btn" data-mode="timeattack">Treino Livre (Solo)</button>
                </div>

                <!-- Seletor de Circuito -->
                <div class="deck-section-title">🌍 Circuito de Corrida</div>
                <div class="track-card">
                  <button class="car-arrow-btn" id="btn-prev-track" aria-label="Circuito anterior">◀</button>
                  <div style="text-align: center; flex: 1; padding: 0 10px;">
                    <div id="menu-track-badge" style="font-family: 'Courier New', monospace, sans-serif; font-size: 15px; font-weight: 900; color: #f59e0b;">
                      🇺🇸 LAS VEGAS
                    </div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                      <span id="menu-track-country">EUA</span> • <span id="menu-track-difficulty" style="color: #10b981; font-weight: 700;">Fácil</span> • <span id="menu-track-length">1200m</span>
                    </div>
                    <div id="menu-track-desc" style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">
                      Retas largas com luzes de neon sob a noite de Nevada.
                    </div>
                  </div>
                  <button class="car-arrow-btn" id="btn-next-track" aria-label="Próximo circuito">▶</button>
                </div>

                <!-- Seletor de Dificuldade da IA -->
                <div id="row-difficulty">
                  <div class="deck-section-title">⚡ Desafio da Inteligência Artificial</div>
                  <div class="tab-btn-group" id="group-diff">
                    <button class="sub-tab-btn" data-diff="amateur">Amador</button>
                    <button class="sub-tab-btn active" data-diff="pro">Pro</button>
                    <button class="sub-tab-btn" data-diff="championship">Campeão</button>
                  </div>
                </div>

                <!-- Dicas Rápidas de Pilotagem -->
                <div style="background: rgba(8, 12, 22, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 8px 12px; font-size: 11px; color: #94a3b8;">
                  <div>🎮 <b>Controles</b>: [W/▲] Acelerar • [S/▼] Freio • [A/D/◄/►] Direção</div>
                  <div>⚡ <b>Turbo & Vácuo</b>: [SHIFT/N] Nitro • Vácuo colado confere +20% velocidade</div>
                </div>
              </div>

              <!-- Botão de Largada Solo -->
              <button id="btn-start" class="btn-launch-solo">🏁 LARGADA (ENTER)</button>
            </div>

            <!-- ABA 2: MULTIPLAYER PADDOCK -->
            <div id="tab-content-multiplayer" style="display: none; flex-direction: column; justify-content: space-between; height: 100%;">
              <div>
                <!-- Conexão / Entrada de Sala (Quando não conectado) -->
                <div id="mp-section-connect">
                  <div class="deck-section-title">🌐 Conexão de Sala WebRTC</div>
                  <div class="mp-connect-grid">
                    <div class="mp-action-card">
                      <div>
                        <div style="font-size: 12px; font-weight: 800; color: #38bdf8; margin-bottom: 2px;">Criar Sala (Host)</div>
                        <div style="font-size: 10px; color: #94a3b8;">Gere uma sala e convide um amigo para o grid.</div>
                      </div>
                      <button id="btn-create-p2p" class="mp-btn-host">✨ Criar Grid (Host)</button>
                    </div>

                    <div class="mp-action-card">
                      <div>
                        <div style="font-size: 12px; font-weight: 800; color: #f59e0b; margin-bottom: 2px;">Entrar com Código</div>
                        <div style="font-size: 10px; color: #94a3b8;">Digite o código da sala gerado pelo Host.</div>
                      </div>
                      <div class="mp-join-row">
                        <input type="text" id="input-room-code" class="mp-code-input" placeholder="CÓDIGO" maxlength="8" />
                        <button id="btn-join-p2p" class="mp-btn-join">Entrar</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Card de Sala Ativa (Quando conectado) -->
                <div id="box-invite-url" class="mp-active-session-card" style="display: none;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span id="mp-room-code-label" class="mp-session-code-badge">SALA: -----</span>
                      <span class="mp-status-pill">
                        <span id="mp-status-dot" class="status-led disconnected"></span>
                        <span id="mp-status-badge">Desconectado</span>
                      </span>
                    </div>
                    <div id="mp-url-display" style="font-size: 10px; color: #38bdf8; margin-top: 2px; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      Link de convite gerado...
                    </div>
                  </div>
                  <button id="btn-copy-url" class="btn-copy-link">📋 Copiar Link</button>
                </div>

                <!-- Status Text Discreto -->
                <div id="mp-status-text" style="color: #94a3b8; font-size: 11px; margin-bottom: 8px; text-align: center;">
                  Escolha seu veículo na garagem à esquerda e crie ou entre em uma sala.
                </div>

                <!-- Lista de Pilotos no Grid -->
                <div class="deck-section-title">🏎️ Pilotos no Grid</div>
                <div id="mp-players-list" class="pilots-roster">
                  <div class="pilot-slot-waiting">
                    Crie uma sala ou entre com um código para iniciar o grid.
                  </div>
                </div>
              </div>

              <!-- Ações da Sala Multiplayer -->
              <div>
                <div class="mp-actions-row">
                  <button id="btn-mp-ready" class="btn-mp-toggle-ready">
                    ✓ ESTOU PRONTO
                  </button>
                  <button id="btn-mp-start" class="btn-mp-start-race" disabled>
                    🏁 INICIAR CORRIDA
                  </button>
                </div>
                <div style="text-align: center;">
                  <button class="btn-exit-subtab" id="btn-back-from-mp">← Desconectar e Voltar ao Modo Solo (ESC)</button>
                </div>
              </div>
            </div>

            <!-- ABA 3: APRESENTAÇÃO & MANUAL -->
            <div id="tab-content-presentation" style="display: none; flex-direction: column; justify-content: space-between; height: 100%;">
              <div class="editorial-container">
                <div class="deck-section-title">📖 Manual de Instruções & Dicas</div>
                <p style="font-size: 12px; color: #cbd5e1; margin-bottom: 12px;">
                  O <b>Top Gear: Legado</b> recria a emoção das corridas arcade clássicas com física moderna determinística, consumo de combustível e disputa direta entre pilotos.
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; color: #94a3b8; margin-bottom: 14px;">
                  <div style="background: rgba(8, 12, 22, 0.5); padding: 8px 10px; border-radius: 8px;">
                    <b style="color: #38bdf8;">💨 Efeito Vácuo</b><br/>Fique logo atrás de outro carro para ganhar +20% de velocidade máxima.
                  </div>
                  <div style="background: rgba(8, 12, 22, 0.5); padding: 8px 10px; border-radius: 8px;">
                    <b style="color: #38bdf8;">⚡ Nitro Limitado</b><br/>3 cargas por prova. Use nas saídas de curva e retas longas.
                  </div>
                  <div style="background: rgba(8, 12, 22, 0.5); padding: 8px 10px; border-radius: 8px;">
                    <b style="color: #f59e0b;">⛽ Pit Stop Estratégico</b><br/>Entre na faixa de boxes à esquerda da reta quando o combustível estiver baixo.
                  </div>
                  <div style="background: rgba(8, 12, 22, 0.5); padding: 8px 10px; border-radius: 8px;">
                    <b style="color: #10b981;">🏁 Multiplayer P2P</b><br/>WebRTC direto e de baixíssima latência para disputas em tempo real.
                  </div>
                </div>
              </div>
              <div style="text-align: center;">
                <button class="btn-exit-subtab" id="btn-back-from-presentation">← Voltar ao Menu Principal (ESC)</button>
              </div>
            </div>

            <!-- ABA 4: CRÉDITOS -->
            <div id="tab-content-credits" style="display: none; flex-direction: column; justify-content: space-between; height: 100%;">
              <div class="editorial-container" style="text-align: center; padding: 20px 0;">
                <div class="deck-section-title" style="justify-content: center;">🏆 Créditos do Projeto</div>
                <p style="color: #f59e0b; font-size: 15px; font-weight: 800; margin-bottom: 12px;">TOP GEAR: LEGADO</p>
                <div style="font-size: 11px; color: #94a3b8; line-height: 1.8;">
                  <p><b style="color: #f8fafc;">Desenvolvimento & Física Web Arcade</b><br/>Equipe Top Gear Legado</p>
                  <p><b style="color: #f8fafc;">Renderização 3D Procedural</b><br/>Three.js + Shaders Retrô</p>
                  <p><b style="color: #f8fafc;">Multiplayer Low-Latency</b><br/>WebRTC P2P + PeerJS Network Engine</p>
                </div>
              </div>
              <div style="text-align: center;">
                <button class="btn-exit-subtab" id="btn-back-from-credits">← Voltar ao Menu Principal (ESC)</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.updateCarDisplay();
    this.updateTrackDisplay();
  }

  private setupMultiplayerListeners(): void {
    this.mpClient.onStatusChangeCallback = (msg, isError) => {
      const textEl = this.overlay.querySelector<HTMLDivElement>('#mp-status-text');
      if (textEl) {
        textEl.textContent = msg;
        textEl.style.color = isError ? '#ef4444' : '#38bdf8';
      }
    };

    this.mpClient.onConnectionStatusChangeCallback = (status) => {
      const badgeEl = this.overlay.querySelector<HTMLSpanElement>('#mp-status-badge');
      const dotEl = this.overlay.querySelector<HTMLSpanElement>('#mp-status-dot');
      if (dotEl) {
        dotEl.className = `status-led ${status}`;
      }
      if (badgeEl) {
        const labels: Record<string, string> = {
          connected: 'Conectado',
          connecting: 'Conectando...',
          reconnecting: 'Reconectando...',
          disconnected: 'Desconectado',
          failed: 'Erro de Conexão',
        };
        badgeEl.textContent = labels[status] || status;
      }
    };

    this.mpClient.onLobbyUpdateCallback = (players, canStart, roomCode) => {
      this.networkPlayers = players;
      this.renderMultiplayerLobby(players, canStart, roomCode);
    };

    this.mpClient.onRaceStartCallback = (players, _totalLaps, trackId) => {
      soundSystem.playBeep(880);
      this.hide();
      if (this.onStartCallback) {
        const track = ALL_TRACKS.find((t) => t.id === trackId) || ALL_TRACKS[this.selectedTrackIndex] || ALL_TRACKS[0];
        this.onStartCallback({
          mode: 'multiplayer',
          carId: ALL_CARS[this.selectedCarIndex].id,
          trackId: track.id,
          trackDefinition: track,
          difficulty: 'pro',
          multiplayerClient: this.mpClient,
          networkPlayers: players,
        });
      }
    };
  }

  public joinRoomByCode(roomCode: string): void {
    this.setTab('multiplayer');
    const input = this.overlay.querySelector<HTMLInputElement>('#input-room-code');
    if (input) {
      input.value = roomCode.toUpperCase();
    }
    const car = ALL_CARS[this.selectedCarIndex];
    this.mpClient.joinP2PRoom(roomCode, this.playerName, car.id).catch((err) => {
      console.warn('[WebRTC Join Error]', err);
    });
  }

  private renderMultiplayerLobby(players: NetworkPlayerInfo[], canStart: boolean, roomCode?: string): void {
    const listEl = this.overlay.querySelector<HTMLDivElement>('#mp-players-list');
    const startBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-start');
    const readyBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-ready');
    const urlDisplay = this.overlay.querySelector<HTMLDivElement>('#mp-url-display');
    const roomCodeLabel = this.overlay.querySelector<HTMLSpanElement>('#mp-room-code-label');
    const inviteBox = this.overlay.querySelector<HTMLDivElement>('#box-invite-url');
    const connectSection = this.overlay.querySelector<HTMLDivElement>('#mp-section-connect');

    const effectiveRoomCode = roomCode || this.mpClient.roomCode;
    if (effectiveRoomCode) {
      if (inviteBox) inviteBox.style.display = 'flex';
      if (connectSection) connectSection.style.display = 'none';

      if (roomCodeLabel) {
        roomCodeLabel.textContent = `SALA: ${effectiveRoomCode}`;
      }

      const inviteUrl = this.mpClient.getInviteUrl() || `${window.location.origin}/?join=${effectiveRoomCode}`;
      if (urlDisplay) {
        urlDisplay.textContent = inviteUrl;
      }
    } else {
      if (inviteBox) inviteBox.style.display = 'none';
      if (connectSection) connectSection.style.display = 'block';
    }

    if (listEl) {
      if (players.length === 0) {
        listEl.innerHTML = `
          <div class="pilot-slot-waiting">
            ⏳ Conectando aos servidores de sinalização...
          </div>
        `;
      } else {
        const renderedCards = players
          .map((p) => {
            const isMe = p.id === this.mpClient.playerId || (this.mpClient.isHost && p.isHost) || (!this.mpClient.isHost && !p.isHost && players.length === 1);
            const car = ALL_CARS.find((c) => c.id === p.carId) || ALL_CARS[0];
            const isReady = p.ready;

            return `
              <div class="pilot-slot-card ${isMe ? 'is-you' : ''}">
                <div class="pilot-meta-left">
                  <span style="font-size: 16px;">🏎️</span>
                  <div>
                    <div style="display: flex; align-items: center;">
                      <span class="pilot-name-title">${escapeHtml(p.name)}</span>
                      ${isMe ? '<span class="badge-micro badge-you">VOCÊ</span>' : ''}
                      ${p.isHost ? '<span class="badge-micro badge-host">HOST</span>' : ''}
                    </div>
                    <div style="margin-top: 2px;">
                      <span class="badge-car-livery" style="color: ${car.color}; border-color: ${car.color}44;">${car.name.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  ${
                    isReady
                      ? '<span class="pilot-state-badge ready">✓ PRONTO</span>'
                      : '<span class="pilot-state-badge waiting">⏳ AGUARDANDO</span>'
                  }
                </div>
              </div>
            `;
          })
          .join('');

        const emptySlot =
          players.length === 1
            ? `
            <div class="pilot-slot-waiting">
              ⏳ Aguardando 2º piloto ingressar pelo link de convite...
            </div>
          `
            : '';

        listEl.innerHTML = renderedCards + emptySlot;
      }
    }

    if (startBtn) {
      startBtn.disabled = !(this.mpClient.isHost && canStart);
      startBtn.style.display = this.mpClient.isHost ? 'flex' : 'none';
    }

    if (readyBtn) {
      readyBtn.style.display = !this.mpClient.isHost ? 'flex' : 'none';
      if (this.isMpReady) {
        readyBtn.textContent = '✓ PRONTO (CANCELAR)';
        readyBtn.classList.add('is-ready');
      } else {
        readyBtn.textContent = '✓ ESTOU PRONTO';
        readyBtn.classList.remove('is-ready');
      }
    }
  }

  private init3DShowcase(): void {
    this.canvasElement = this.overlay.querySelector<HTMLCanvasElement>('#menu-car-canvas');
    if (this.canvasElement) {
      this.carShowcase = new CarShowcase(this.canvasElement);
      this.carShowcase.start();
    }
  }

  public setTab(tab: MenuTab): void {
    this.currentTab = tab;
    soundSystem.playBeep(520);

    const mainEl = this.overlay.querySelector<HTMLDivElement>('#tab-content-main');
    const presEl = this.overlay.querySelector<HTMLDivElement>('#tab-content-presentation');
    const credEl = this.overlay.querySelector<HTMLDivElement>('#tab-content-credits');
    const mpEl = this.overlay.querySelector<HTMLDivElement>('#tab-content-multiplayer');

    const navMain = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-main');
    const navMp = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-multiplayer');
    const navPres = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-presentation');
    const navCred = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-credits');

    [navMain, navMp, navPres, navCred].forEach((b) => b?.classList.remove('active'));

    if (mainEl) mainEl.style.display = tab === 'main' ? 'flex' : 'none';
    if (presEl) presEl.style.display = tab === 'presentation' ? 'flex' : 'none';
    if (credEl) credEl.style.display = tab === 'credits' ? 'flex' : 'none';
    if (mpEl) mpEl.style.display = tab === 'multiplayer' ? 'flex' : 'none';

    if (tab === 'main') navMain?.classList.add('active');
    if (tab === 'multiplayer') navMp?.classList.add('active');
    if (tab === 'presentation') navPres?.classList.add('active');
    if (tab === 'credits') navCred?.classList.add('active');

    const nameInput = this.overlay.querySelector<HTMLInputElement>('#input-player-name');
    if (nameInput) {
      nameInput.value = this.playerName;
    }
  }

  private syncMultiplayerCarAndName(): void {
    const car = ALL_CARS[this.selectedCarIndex];
    if (this.mpClient.isConnected || this.mpClient.isHost) {
      this.mpClient.joinLobby(this.playerName, car.id);
      if (!this.mpClient.isHost) {
        this.mpClient.setReady(this.isMpReady, car.id);
      }
    }
  }

  private bindEvents(): void {
    // Input de Nome do Jogador
    const nameInput = this.overlay.querySelector<HTMLInputElement>('#input-player-name');
    if (nameInput) {
      nameInput.value = this.playerName;
      nameInput.oninput = () => {
        const val = nameInput.value.trim();
        this.playerName = val || 'Piloto';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('topgear_player_name', this.playerName);
        }
        this.syncMultiplayerCarAndName();
      };
    }

    // Abas de Navegação Principal
    const navMain = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-main');
    const navMp = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-multiplayer');
    const navPres = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-presentation');
    const navCred = this.overlay.querySelector<HTMLButtonElement>('#tab-nav-credits');

    if (navMain) navMain.onclick = () => this.setTab('main');
    if (navMp) navMp.onclick = () => this.setTab('multiplayer');
    if (navPres) navPres.onclick = () => this.setTab('presentation');
    if (navCred) navCred.onclick = () => this.setTab('credits');

    // Modos Solo (Corrida / Treino Livre)
    const modeBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#group-mode .sub-tab-btn');
    modeBtns.forEach((btn) => {
      btn.onclick = () => {
        modeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = btn.getAttribute('data-mode') as RaceMode;

        const diffRow = this.overlay.querySelector<HTMLDivElement>('#row-difficulty');
        if (diffRow) {
          diffRow.style.display = this.selectedMode === 'timeattack' ? 'none' : 'block';
        }
        soundSystem.playBeep(440);
      };
    });

    // Navegação de Pistas
    const prevTrackBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-prev-track');
    const nextTrackBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-next-track');

    if (prevTrackBtn) {
      prevTrackBtn.onclick = () => {
        this.selectedTrackIndex = (this.selectedTrackIndex - 1 + ALL_TRACKS.length) % ALL_TRACKS.length;
        this.updateTrackDisplay();
        soundSystem.playBeep(580);
      };
    }
    if (nextTrackBtn) {
      nextTrackBtn.onclick = () => {
        this.selectedTrackIndex = (this.selectedTrackIndex + 1) % ALL_TRACKS.length;
        this.updateTrackDisplay();
        soundSystem.playBeep(580);
      };
    }

    // Abas de Dificuldade
    const diffBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#group-diff .sub-tab-btn');
    diffBtns.forEach((btn) => {
      btn.onclick = () => {
        diffBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.getAttribute('data-diff') as AIDifficulty;
        soundSystem.playBeep(440);
      };
    });

    // Navegação de Carros (Universal)
    const prevBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-prev-car');
    const nextBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-next-car');

    if (prevBtn) {
      prevBtn.onclick = () => {
        this.selectedCarIndex = (this.selectedCarIndex - 1 + ALL_CARS.length) % ALL_CARS.length;
        this.updateCarDisplay();
        this.syncMultiplayerCarAndName();
        soundSystem.playBeep(620);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        this.selectedCarIndex = (this.selectedCarIndex + 1) % ALL_CARS.length;
        this.updateCarDisplay();
        this.syncMultiplayerCarAndName();
        soundSystem.playBeep(620);
      };
    }

    // Botão Iniciar Single Player
    const startBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-start');
    if (startBtn) {
      startBtn.onclick = () => this.startGame();
    }

    // Botões Multiplayer P2P
    const btnCreateP2P = this.overlay.querySelector<HTMLButtonElement>('#btn-create-p2p');
    if (btnCreateP2P) {
      btnCreateP2P.onclick = () => {
        const car = ALL_CARS[this.selectedCarIndex];
        this.mpClient.createP2PRoom(this.playerName, car.id).catch((err) => {
          console.warn('[WebRTC Create Room Error]', err);
        });
      };
    }

    const btnJoinP2P = this.overlay.querySelector<HTMLButtonElement>('#btn-join-p2p');
    const inputRoom = this.overlay.querySelector<HTMLInputElement>('#input-room-code');
    if (btnJoinP2P && inputRoom) {
      btnJoinP2P.onclick = () => {
        const code = inputRoom.value.trim().toUpperCase();
        if (!code) {
          alert('Por favor, digite o código da sala gerado pelo seu amigo.');
          return;
        }
        this.joinRoomByCode(code);
      };
    }

    const btnCopy = this.overlay.querySelector<HTMLButtonElement>('#btn-copy-url');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const inviteUrl = this.mpClient.getInviteUrl() || window.location.href;
        navigator.clipboard.writeText(inviteUrl);
        btnCopy.textContent = '✓ Copiado!';
        setTimeout(() => {
          btnCopy.textContent = '📋 Copiar Link';
        }, 2000);
      };
    }

    const btnReady = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-ready');
    if (btnReady) {
      btnReady.onclick = () => {
        this.isMpReady = !this.isMpReady;
        const car = ALL_CARS[this.selectedCarIndex];
        this.mpClient.setReady(this.isMpReady, car.id);
        this.renderMultiplayerLobby(this.networkPlayers, false);
      };
    }

    const btnMpStart = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-start');
    if (btnMpStart) {
      btnMpStart.onclick = () => {
        if (this.networkPlayers.length < 2) {
          alert('Aguarde o segundo piloto entrar na sala e ficar PRONTO antes de iniciar a largada!');
          return;
        }
        const track = ALL_TRACKS[this.selectedTrackIndex] || ALL_TRACKS[0];
        this.mpClient.startRace(track.id);
      };
    }

    // Botões de Voltar
    const btnBackPres = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-presentation');
    const btnBackCred = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-credits');
    const btnBackMp = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-mp');

    if (btnBackPres) btnBackPres.onclick = () => this.setTab('main');
    if (btnBackCred) btnBackCred.onclick = () => this.setTab('main');
    if (btnBackMp) {
      btnBackMp.onclick = () => {
        this.mpClient.disconnect();
        this.setTab('main');
      };
    }
  }

  private updateTrackDisplay(): void {
    const track: TrackDefinition = ALL_TRACKS[this.selectedTrackIndex] || ALL_TRACKS[0];
    const badge = this.overlay.querySelector<HTMLDivElement>('#menu-track-badge');
    const country = this.overlay.querySelector<HTMLSpanElement>('#menu-track-country');
    const diff = this.overlay.querySelector<HTMLSpanElement>('#menu-track-difficulty');
    const len = this.overlay.querySelector<HTMLSpanElement>('#menu-track-length');
    const desc = this.overlay.querySelector<HTMLDivElement>('#menu-track-desc');

    const diffColors: Record<string, string> = {
      'Fácil': '#10b981',
      'Médio': '#f59e0b',
      'Difícil': '#f97316',
      'Extremo': '#ef4444',
    };

    if (badge) {
      badge.textContent = `${track.flag} ${track.name.toUpperCase()}`;
      badge.style.color = track.theme?.accentColor || '#f1c40f';
    }
    if (country) {
      country.textContent = track.country;
    }
    if (diff) {
      diff.textContent = track.difficulty;
      diff.style.color = diffColors[track.difficulty] || '#38bdf8';
    }
    if (len) {
      const totalMeters =
        track.lengthMeters ??
        Math.round(
          track.segments.reduce(
            (acc, s) => acc + (s.type === 'straight' ? s.length : s.radius * ((s.angle * Math.PI) / 180)),
            0
          )
        );
      len.textContent = `${totalMeters}m`;
    }
    if (desc) {
      desc.textContent = track.theme?.description || '';
    }
  }

  private updateCarDisplay(): void {
    const car: CarStats = ALL_CARS[this.selectedCarIndex];
    const badge = this.overlay.querySelector<HTMLDivElement>('#menu-car-badge');
    const desc = this.overlay.querySelector<HTMLDivElement>('#menu-car-desc');
    const statSpeed = this.overlay.querySelector<HTMLDivElement>('#stat-speed');
    const statAccel = this.overlay.querySelector<HTMLDivElement>('#stat-accel');
    const statHandling = this.overlay.querySelector<HTMLDivElement>('#stat-handling');
    const statFuel = this.overlay.querySelector<HTMLDivElement>('#stat-fuel');

    const carDescriptions: Record<CarId, string> = {
      cannibal: 'Foguete em retas com alto consumo',
      sidewinder: 'Equilíbrio ideal de velocidade e frenagem',
      razor: 'Aceleração brutal e aderência nas curvas',
      weasel: 'Econômico e extremamente ágil',
      night_viper: 'Superbike Bônus: Aceleração insana e agilidade',
    };

    if (badge) {
      badge.textContent = car.name.toUpperCase();
      badge.style.color = car.color;
    }
    if (desc) {
      desc.textContent = carDescriptions[car.id] || 'Veículo esportivo';
    }
    if (statSpeed) statSpeed.style.width = `${(car.topSpeed / 96) * 100}%`;
    if (statAccel) statAccel.style.width = `${(car.acceleration / 36) * 100}%`;
    if (statHandling) statHandling.style.width = `${(car.handling / 3.5) * 100}%`;
    if (statFuel) statFuel.style.width = `${(car.fuelConsumption / 4.0) * 100}%`;

    if (this.carShowcase) {
      this.carShowcase.setCar(car);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isVisible) return;

    // Ignora atalhos globais se o foco estiver num input de texto
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    if (e.code === 'Escape') {
      if (this.currentTab !== 'main') {
        if (this.currentTab === 'multiplayer') {
          this.mpClient.disconnect();
        }
        this.setTab('main');
      }
    } else if (this.currentTab === 'main') {
      if (e.code === 'Enter' || e.code === 'Space') {
        this.startGame();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.selectedCarIndex = (this.selectedCarIndex - 1 + ALL_CARS.length) % ALL_CARS.length;
        this.updateCarDisplay();
        soundSystem.playBeep(620);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selectedCarIndex = (this.selectedCarIndex + 1) % ALL_CARS.length;
        this.updateCarDisplay();
        soundSystem.playBeep(620);
      }
    } else if (this.currentTab === 'multiplayer') {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.selectedCarIndex = (this.selectedCarIndex - 1 + ALL_CARS.length) % ALL_CARS.length;
        this.updateCarDisplay();
        this.syncMultiplayerCarAndName();
        soundSystem.playBeep(620);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selectedCarIndex = (this.selectedCarIndex + 1) % ALL_CARS.length;
        this.updateCarDisplay();
        this.syncMultiplayerCarAndName();
        soundSystem.playBeep(620);
      }
    }
  };

  private startGame(): void {
    soundSystem.playBeep(880);
    this.hide();
    if (this.onStartCallback) {
      const track = ALL_TRACKS[this.selectedTrackIndex] || ALL_TRACKS[0];
      this.onStartCallback({
        mode: this.selectedMode,
        carId: ALL_CARS[this.selectedCarIndex].id,
        trackId: track.id,
        trackDefinition: track,
        difficulty: this.selectedDifficulty,
      });
    }
  }

  public show(): void {
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    const roomCode = MultiplayerClient.parseRoomFromUrl();
    if (roomCode) {
      this.setTab('multiplayer');
      this.joinRoomByCode(roomCode);
    } else {
      this.setTab('main');
    }
    if (this.carShowcase) {
      this.carShowcase.start();
    }
  }

  public hide(): void {
    this.isVisible = false;
    this.overlay.style.display = 'none';
    if (this.carShowcase) {
      this.carShowcase.stop();
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.carShowcase) {
      this.carShowcase.destroy();
    }
    this.overlay.remove();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
