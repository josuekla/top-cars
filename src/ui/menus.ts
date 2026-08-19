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
          background: radial-gradient(ellipse at 50% 30%, rgba(18, 24, 42, 0.96) 0%, rgba(8, 11, 20, 0.98) 100%);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
          color: #f8fafc;
          z-index: 999;
          user-select: none;
          overflow-y: auto;
          padding: 20px 16px;
        }

        .menu-title-box {
          text-align: center;
          margin-bottom: 14px;
          position: relative;
        }

        .retro-main-title {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 38px;
          font-weight: 900;
          letter-spacing: 4px;
          color: #f1c40f;
          text-shadow: 0 0 20px rgba(241, 196, 15, 0.4);
          margin: 0;
        }

        .retro-sub-title {
          font-size: 11px;
          letter-spacing: 3px;
          color: #38bdf8;
          margin-top: 4px;
          text-transform: uppercase;
          font-weight: 700;
        }

        .menu-card {
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 22px 28px;
          width: 94%;
          max-width: 840px;
          box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
          position: relative;
          z-index: 1001;
          backdrop-filter: blur(12px);
        }

        .menu-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media (max-width: 768px) {
          .menu-grid {
            grid-template-columns: 1fr;
          }
          .retro-main-title {
            font-size: 28px;
          }
        }

        .menu-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #94a3b8;
          margin-bottom: 6px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tab-group {
          display: flex;
          gap: 6px;
        }

        .tab-btn {
          flex: 1;
          background: rgba(30, 41, 59, 0.6);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 9px 12px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .tab-btn:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .tab-btn.active {
          background: #ef4444;
          border-color: #f87171;
          color: #fff;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
        }

        .tab-btn.tab-btn-mp {
          border-color: rgba(56, 189, 248, 0.4);
          color: #38bdf8;
        }

        .tab-btn.tab-btn-mp:hover {
          background: rgba(56, 189, 248, 0.15);
          border-color: #38bdf8;
        }

        .showcase-container {
          background: radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.9) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        #menu-car-canvas {
          width: 100%;
          height: 170px;
          display: block;
        }

        .car-selector-nav {
          display: flex;
          width: 100%;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(10, 15, 29, 0.7);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .nav-arrow-btn {
          background: rgba(30, 41, 59, 0.8);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
        }

        .nav-arrow-btn:hover {
          background: rgba(51, 65, 85, 1);
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .car-name-badge {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .car-desc-text {
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
          margin-top: 2px;
        }

        .car-stats-card {
          margin-top: 10px;
          background: rgba(10, 15, 29, 0.6);
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .car-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 6px;
          color: #cbd5e1;
        }

        .car-stat-row:last-child {
          margin-bottom: 0;
        }

        .stat-bar-bg {
          width: 55%;
          height: 5px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 3px;
          overflow: hidden;
        }

        .stat-bar-fill {
          height: 100%;
          background: #38bdf8;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .track-selector-nav {
          background: rgba(10, 15, 29, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .btn-start-race {
          width: 100%;
          margin-top: 14px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #fff;
          border: none;
          padding: 13px 20px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 1.5px;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-start-race:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
          background: linear-gradient(135deg, #34d399 0%, #059669 100%);
        }

        .btn-start-race:disabled {
          background: rgba(51, 65, 85, 0.5);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
          color: #64748b;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .menu-footer-nav {
          display: flex;
          gap: 10px;
          margin-top: 14px;
        }

        .btn-sub-nav {
          flex: 1;
          background: rgba(30, 41, 59, 0.4);
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-sub-nav:hover {
          background: rgba(51, 65, 85, 0.7);
          color: #f1c40f;
          border-color: rgba(241, 196, 15, 0.4);
        }

        .sub-screen-card {
          padding: 4px;
          line-height: 1.6;
        }

        .sub-screen-title {
          font-size: 20px;
          color: #f1c40f;
          font-weight: 800;
          margin-bottom: 14px;
          text-align: center;
          letter-spacing: 1px;
        }

        .btn-back-menu {
          background: rgba(30, 41, 59, 0.6);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 10px 20px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 16px;
          display: block;
          width: 100%;
          transition: all 0.15s;
        }

        .btn-back-menu:hover {
          background: rgba(51, 65, 85, 0.9);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.25);
        }

        /* MULTIPLAYER REDESIGN */
        .mp-pilot-config-card {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: rgba(10, 15, 29, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 14px;
        }

        @media (max-width: 600px) {
          .mp-pilot-config-card {
            grid-template-columns: 1fr;
          }
        }

        .mp-input {
          width: 100%;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 12px;
          color: #38bdf8;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .mp-input:focus {
          border-color: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
        }

        .mp-car-picker {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 4px 8px;
          height: 38px;
        }

        .mp-car-badge {
          font-family: 'Courier New', monospace, sans-serif;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 1px;
        }

        .room-controls-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .room-input {
          flex: 1;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 9px 12px;
          color: #f1c40f;
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
          outline: none;
        }

        .room-input:focus {
          border-color: #f1c40f;
          box-shadow: 0 0 10px rgba(241, 196, 15, 0.25);
        }

        .btn-action-primary {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-action-primary:hover {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35);
        }

        .btn-action-host {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .btn-action-host:hover {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
        }

        .room-active-card {
          background: rgba(10, 15, 29, 0.7);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .room-code-tag {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 16px;
          font-weight: 900;
          color: #f1c40f;
          letter-spacing: 2px;
        }

        .status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }

        .status-dot.connected { background: #10b981; box-shadow: 0 0 6px #10b981; }
        .status-dot.connecting { background: #f59e0b; box-shadow: 0 0 6px #f59e0b; }
        .status-dot.disconnected { background: #64748b; }
        .status-dot.failed { background: #ef4444; }

        /* PILOT CARDS */
        .pilots-list-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
        }

        .pilot-card {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .pilot-card.is-local {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(14, 165, 233, 0.06);
        }

        .pilot-info-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .pilot-car-icon {
          font-size: 18px;
        }

        .pilot-name-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pilot-name-text {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
        }

        .badge-tag {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-you {
          background: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .badge-host {
          background: rgba(241, 196, 15, 0.2);
          color: #f1c40f;
          border: 1px solid rgba(241, 196, 15, 0.3);
        }

        .badge-car-name {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .pilot-status-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .pilot-status-badge.ready {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .pilot-status-badge.waiting {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .pilot-slot-empty {
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: 12px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          background: rgba(15, 23, 42, 0.3);
        }
      </style>

      <div class="menu-title-box">
        <h1 class="retro-main-title">TOP GEAR: LEGADO</h1>
        <div class="retro-sub-title">16-BIT RETRO ARCADE RACING</div>
      </div>

      <!-- PAINEL PRINCIPAL DO MENU -->
      <div id="tab-content-main" class="menu-card">
        <div class="menu-grid">
          <!-- Coluna Esquerda: Showcase 3D Girando -->
          <div>
            <div class="menu-label">🏎️ Veículo Selecionado</div>
            <div class="showcase-container">
              <canvas id="menu-car-canvas"></canvas>
              <div class="car-selector-nav">
                <button class="nav-arrow-btn" id="btn-prev-car" aria-label="Carro anterior">◀</button>
                <div style="text-align: center;">
                  <div id="menu-car-badge" class="car-name-badge" style="color: #e74c3c;">CANNIBAL</div>
                  <div id="menu-car-desc" class="car-desc-text">Máxima velocidade em retas</div>
                </div>
                <button class="nav-arrow-btn" id="btn-next-car" aria-label="Próximo carro">▶</button>
              </div>
            </div>

            <!-- Barras de Atributos -->
            <div class="car-stats-card">
              <div class="car-stat-row">
                <span>Velocidade Máx</span>
                <div class="stat-bar-bg"><div id="stat-speed" class="stat-bar-fill" style="width: 90%;"></div></div>
              </div>
              <div class="car-stat-row">
                <span>Aceleração</span>
                <div class="stat-bar-bg"><div id="stat-accel" class="stat-bar-fill" style="width: 75%;"></div></div>
              </div>
              <div class="car-stat-row">
                <span>Manuseio</span>
                <div class="stat-bar-bg"><div id="stat-handling" class="stat-bar-fill" style="width: 70%;"></div></div>
              </div>
              <div class="car-stat-row">
                <span>Consumo Gasolina</span>
                <div class="stat-bar-bg"><div id="stat-fuel" class="stat-bar-fill" style="width: 90%; background: #ef4444;"></div></div>
              </div>
            </div>
          </div>

          <!-- Coluna Direita: Modo, Pista, Dificuldade e Largada -->
          <div style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <!-- Modo de Jogo -->
              <div style="margin-bottom: 12px;">
                <div class="menu-label">🎮 Modo de Jogo</div>
                <div class="tab-group" id="group-mode">
                  <button class="tab-btn active" data-mode="race">🏆 Corrida vs IA</button>
                  <button class="tab-btn" data-mode="timeattack">⏱️ Time Attack</button>
                  <button class="tab-btn tab-btn-mp" data-mode="multiplayer">🌐 Multiplayer</button>
                </div>
              </div>

              <!-- Seletor Visual de Pista -->
              <div style="margin-bottom: 12px;">
                <div class="menu-label">🏁 Circuito Oficial</div>
                <div class="track-selector-nav">
                  <button class="nav-arrow-btn" id="btn-prev-track" aria-label="Circuito anterior">◀</button>
                  <div style="text-align: center; flex: 1; margin: 0 10px; overflow: hidden;">
                    <div id="menu-track-badge" style="font-size: 13px; font-weight: 800; letter-spacing: 0.5px; color: #f1c40f; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      🇺🇸 LAS VEGAS SUNSET SPEEDWAY
                    </div>
                    <div id="menu-track-info" style="font-size: 10px; color: #38bdf8; margin-top: 3px; display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                      <span id="menu-track-country">Estados Unidos</span>
                      <span>•</span>
                      <span id="menu-track-difficulty" style="color: #10b981; font-weight: 700;">Fácil</span>
                      <span>•</span>
                      <span id="menu-track-length" style="color: #cbd5e1;">963m</span>
                    </div>
                    <div id="menu-track-desc" style="font-size: 9px; color: #64748b; margin-top: 2px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      Pôr do sol iluminando a strip de cassinos no deserto de Nevada
                    </div>
                  </div>
                  <button class="nav-arrow-btn" id="btn-next-track" aria-label="Próximo circuito">▶</button>
                </div>
              </div>

              <!-- Dificuldade -->
              <div style="margin-bottom: 12px;" id="row-difficulty">
                <div class="menu-label">⚡ Dificuldade da IA</div>
                <div class="tab-group" id="group-diff">
                  <button class="tab-btn" data-diff="amateur">Amador</button>
                  <button class="tab-btn active" data-diff="pro">Pro</button>
                  <button class="tab-btn" data-diff="championship">Campeão</button>
                </div>
              </div>

              <!-- Dicas Rápidas -->
              <div style="background: rgba(10, 15, 29, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 8px 10px; font-size: 11px; color: #94a3b8;">
                <div>🎮 <b>Controles</b>: [W/▲] Acelerar • [S/▼] Freio/Ré • [A/D/◄/►] Direção</div>
                <div>⚡ <b>Turbo & Vácuo</b>: [SHIFT/N] Nitro • Vácuo colado confere +20% velocidade</div>
              </div>
            </div>

            <!-- Botão Iniciar -->
            <button id="btn-start" class="btn-start-race">🏁 LARGADA (ENTER)</button>
          </div>
        </div>

        <!-- Rodapé do Menu -->
        <div class="menu-footer-nav">
          <button class="btn-sub-nav" id="btn-show-presentation">📖 Apresentação & Dicas</button>
          <button class="btn-sub-nav" id="btn-show-credits">🏆 Créditos</button>
        </div>
      </div>

      <!-- PAINEL MULTIPLAYER -->
      <div id="tab-content-multiplayer" class="menu-card" style="display: none;">
        <div class="sub-screen-card">
          <div class="sub-screen-title">🌐 LOBBY MULTIPLAYER</div>

          <!-- Personalização do Piloto (Nome & Veículo) -->
          <div class="mp-pilot-config-card">
            <div>
              <label class="menu-label" for="input-player-name">👤 Nome do Piloto</label>
              <input type="text" id="input-player-name" class="mp-input" placeholder="Seu nome..." maxlength="16" />
            </div>
            <div>
              <div class="menu-label">🏎️ Selecionar Veículo</div>
              <div class="mp-car-picker">
                <button class="nav-arrow-btn" id="btn-mp-prev-car" style="width: 28px; height: 28px;">◀</button>
                <span id="mp-car-badge" class="mp-car-badge" style="color: #e74c3c;">CANNIBAL</span>
                <button class="nav-arrow-btn" id="btn-mp-next-car" style="width: 28px; height: 28px;">▶</button>
              </div>
            </div>
          </div>

          <!-- Seção de Criar / Entrar em Sala (visível quando não conectado) -->
          <div id="mp-section-connect" class="room-controls-row">
            <button id="btn-create-p2p" class="btn-action-primary btn-action-host" style="flex: 1;">
              ✨ Criar Sala (Host)
            </button>
            <input type="text" id="input-room-code" class="room-input" placeholder="CÓDIGO" maxlength="8" />
            <button id="btn-join-p2p" class="btn-action-primary" style="flex: 0 0 110px;">
              🚀 Entrar
            </button>
          </div>

          <!-- Card de Sala Ativa com Código e Link de Convite -->
          <div id="box-invite-url" class="room-active-card" style="display: none;">
            <div style="flex: 1; overflow: hidden;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span class="room-code-tag" id="mp-room-code-label">SALA: -----</span>
                <span id="mp-status-dot" class="status-dot disconnected"></span>
                <span id="mp-status-badge" style="font-size: 10px; color: #94a3b8;">Desconectado</span>
              </div>
              <div id="mp-url-display" style="font-size: 11px; color: #38bdf8; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                Gerando link...
              </div>
            </div>
            <button id="btn-copy-url" class="btn-action-primary" style="padding: 6px 12px; font-size: 11px;">
              📋 Copiar Link
            </button>
          </div>

          <!-- Status Text Discreto -->
          <div id="mp-status-text" style="color: #94a3b8; font-size: 11px; margin-bottom: 10px; text-align: center;">
            Aguardando ação...
          </div>

          <!-- Lista de Pilotos Conectados -->
          <div class="menu-label">Pilotos na Sala:</div>
          <div id="mp-players-list" class="pilots-list-container">
            <div class="pilot-slot-empty">
              Crie uma sala ou entre com um código para iniciar.
            </div>
          </div>

          <!-- Botões de Ação da Sala -->
          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button id="btn-mp-ready" class="btn-action-primary" style="flex: 1; padding: 12px; font-size: 14px; background: rgba(30, 41, 59, 0.8);">
              ✓ ESTOU PRONTO
            </button>
            <button id="btn-mp-start" class="btn-start-race" style="flex: 1; margin: 0; padding: 12px; font-size: 14px;" disabled>
              🏁 INICIAR CORRIDA
            </button>
          </div>

          <button class="btn-back-menu" id="btn-back-from-mp">← Voltar ao Menu Principal (ESC)</button>
        </div>
      </div>

      <!-- PAINEL DE APRESENTAÇÃO -->
      <div id="tab-content-presentation" class="menu-card" style="display: none;">
        <div class="sub-screen-card">
          <div class="sub-screen-title">📖 MANUAL DO PILOTO</div>
          <p style="color: #38bdf8; font-weight: 600; margin-bottom: 8px;">Bem-vindo ao Top Gear: Legado!</p>
          <p style="font-size: 13px; color: #cbd5e1; margin-bottom: 14px;">
            Inspirado no clássico de corrida dos anos 90, o <b>Top Gear: Legado</b> recria a velocidade arcade com física determinística a 60 Hz, consumo de combustível, pit stops estratégicos e colisões intensas entre pilotos.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; color: #cbd5e1;">
            <div style="background: rgba(10, 15, 29, 0.5); padding: 10px; border-radius: 8px;">
              <b style="color: #f1c40f;">⚡ Vácuo (Slipstream)</b><br/>
              Andar colado atrás de outro carro confere até +20% de aceleração.
            </div>
            <div style="background: rgba(10, 15, 29, 0.5); padding: 10px; border-radius: 8px;">
              <b style="color: #f1c40f;">🚀 Cargas de Nitro</b><br/>
              Você tem 3 cargas de turbo por volta para ultrapassagens fulminantes.
            </div>
            <div style="background: rgba(10, 15, 29, 0.5); padding: 10px; border-radius: 8px;">
              <b style="color: #f1c40f;">💥 Colisões Arcade</b><br/>
              Bater ou empurrar adversários afeta a trajetória de ambos em pista.
            </div>
            <div style="background: rgba(10, 15, 29, 0.5); padding: 10px; border-radius: 8px;">
              <b style="color: #f1c40f;">⛽ Pit Stop</b><br/>
              Entre na faixa de boxes à esquerda da reta para reabastecer combustível.
            </div>
          </div>

          <button class="btn-back-menu" id="btn-back-from-presentation">← Voltar ao Menu Principal (ESC)</button>
        </div>
      </div>

      <!-- PAINEL DE FIM E CRÉDITOS -->
      <div id="tab-content-credits" class="menu-card" style="display: none;">
        <div class="sub-screen-card" style="text-align: center;">
          <div class="sub-screen-title">🏆 CRÉDITOS</div>
          <p style="color: #f1c40f; font-size: 15px; font-weight: 800; margin-bottom: 12px;">OBRIGADO POR JOGAR!</p>
          
          <div style="font-size: 12px; color: #94a3b8; line-height: 1.8;">
            <p><b style="color: #f8fafc;">Desenvolvimento & Física Web Arcade</b><br/>Equipe Top Gear Legado</p>
            <p><b style="color: #f8fafc;">Renderização 3D Procedural</b><br/>Three.js + Shaders Retrô</p>
            <p><b style="color: #f8fafc;">Multiplayer Low-Latency</b><br/>WebRTC P2P + PeerJS Network Engine</p>
          </div>

          <button class="btn-back-menu" id="btn-back-from-credits">← Voltar ao Menu Principal (ESC)</button>
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
        dotEl.className = `status-dot ${status}`;
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
      if (connectSection) connectSection.style.display = 'flex';
    }

    if (listEl) {
      if (players.length === 0) {
        listEl.innerHTML = `
          <div class="pilot-slot-empty">
            ⏳ Aguardando conexão com a sala...
          </div>
        `;
      } else {
        const renderedCards = players
          .map((p) => {
            const isMe = p.id === this.mpClient.playerId || (this.mpClient.isHost && p.isHost) || (!this.mpClient.isHost && !p.isHost && players.length === 1);
            const car = ALL_CARS.find((c) => c.id === p.carId) || ALL_CARS[0];
            const isReady = p.ready;

            return `
              <div class="pilot-card ${isMe ? 'is-local' : ''}">
                <div class="pilot-info-left">
                  <span class="pilot-car-icon">🏎️</span>
                  <div>
                    <div class="pilot-name-box">
                      <span class="pilot-name-text">${escapeHtml(p.name)}</span>
                      ${isMe ? '<span class="badge-tag badge-you">VOCÊ</span>' : ''}
                      ${p.isHost ? '<span class="badge-tag badge-host">HOST</span>' : ''}
                    </div>
                    <div style="margin-top: 2px;">
                      <span class="badge-car-name" style="color: ${car.color}; border-color: ${car.color}44;">${car.name.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  ${
                    isReady
                      ? '<span class="pilot-status-badge ready">✓ PRONTO</span>'
                      : '<span class="pilot-status-badge waiting">⏳ AGUARDANDO</span>'
                  }
                </div>
              </div>
            `;
          })
          .join('');

        const emptySlot =
          players.length === 1
            ? `
            <div class="pilot-slot-empty">
              ⏳ Aguardando 2º piloto entrar pelo link ou código...
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
        readyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        readyBtn.style.borderColor = '#10b981';
      } else {
        readyBtn.textContent = '✓ ESTOU PRONTO';
        readyBtn.style.background = 'rgba(30, 41, 59, 0.8)';
        readyBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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

    if (mainEl) mainEl.style.display = tab === 'main' ? 'block' : 'none';
    if (presEl) presEl.style.display = tab === 'presentation' ? 'block' : 'none';
    if (credEl) credEl.style.display = tab === 'credits' ? 'block' : 'none';
    if (mpEl) mpEl.style.display = tab === 'multiplayer' ? 'block' : 'none';

    if (tab === 'multiplayer') {
      const nameInput = this.overlay.querySelector<HTMLInputElement>('#input-player-name');
      if (nameInput) {
        nameInput.value = this.playerName;
      }
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

    // Abas de Modo
    const modeBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#group-mode .tab-btn');
    modeBtns.forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        if (mode === 'multiplayer') {
          this.setTab('multiplayer');
          return;
        }

        modeBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedMode = mode as RaceMode;

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
    const diffBtns = this.overlay.querySelectorAll<HTMLButtonElement>('#group-diff .tab-btn');
    diffBtns.forEach((btn) => {
      btn.onclick = () => {
        diffBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.getAttribute('data-diff') as AIDifficulty;
        soundSystem.playBeep(440);
      };
    });

    // Navegação de Carros (Menu Principal)
    const prevBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-prev-car');
    const nextBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-next-car');

    if (prevBtn) {
      prevBtn.onclick = () => {
        this.selectedCarIndex = (this.selectedCarIndex - 1 + ALL_CARS.length) % ALL_CARS.length;
        this.updateCarDisplay();
        soundSystem.playBeep(620);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        this.selectedCarIndex = (this.selectedCarIndex + 1) % ALL_CARS.length;
        this.updateCarDisplay();
        soundSystem.playBeep(620);
      };
    }

    // Navegação de Carros (Lobby Multiplayer)
    const mpPrevCarBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-prev-car');
    const mpNextCarBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-next-car');

    if (mpPrevCarBtn) {
      mpPrevCarBtn.onclick = () => {
        this.selectedCarIndex = (this.selectedCarIndex - 1 + ALL_CARS.length) % ALL_CARS.length;
        this.updateCarDisplay();
        this.syncMultiplayerCarAndName();
        soundSystem.playBeep(620);
      };
    }
    if (mpNextCarBtn) {
      mpNextCarBtn.onclick = () => {
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

    // Navegação para Apresentação, Créditos e Voltar
    const btnPres = this.overlay.querySelector<HTMLButtonElement>('#btn-show-presentation');
    const btnCred = this.overlay.querySelector<HTMLButtonElement>('#btn-show-credits');
    const btnBackPres = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-presentation');
    const btnBackCred = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-credits');
    const btnBackMp = this.overlay.querySelector<HTMLButtonElement>('#btn-back-from-mp');

    if (btnPres) btnPres.onclick = () => this.setTab('presentation');
    if (btnCred) btnCred.onclick = () => this.setTab('credits');
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
    const mpBadge = this.overlay.querySelector<HTMLSpanElement>('#mp-car-badge');
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
    if (mpBadge) {
      mpBadge.textContent = car.name.toUpperCase();
      mpBadge.style.color = car.color;
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
