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

  private carShowcase: CarShowcase | null = null;
  private canvasElement: HTMLCanvasElement | null = null;

  // Multiplayer
  public mpClient: MultiplayerClient = new MultiplayerClient();
  private isMpReady: boolean = false;
  public networkPlayers: NetworkPlayerInfo[] = [];

  constructor(container: HTMLElement, onStart?: (options: MenuStartOptions) => void) {
    this.container = container;
    this.onStartCallback = onStart;
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
          background: radial-gradient(circle at center, rgba(20, 24, 48, 0.96), rgba(6, 8, 16, 0.99));
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Courier New', monospace, sans-serif;
          color: #fff;
          z-index: 999;
          user-select: none;
          overflow: hidden;
        }

        #retro-menu-overlay::before {
          content: " ";
          display: block;
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
          background-size: 100% 4px;
          z-index: 1000;
          pointer-events: none;
          opacity: 0.7;
        }

        .menu-title-box {
          text-align: center;
          margin-bottom: 12px;
          position: relative;
        }

        .retro-main-title {
          font-size: 44px;
          font-weight: 900;
          letter-spacing: 5px;
          color: #f1c40f;
          text-shadow: 0 0 16px rgba(241, 196, 15, 0.8), 4px 4px 0 #c0392b, 6px 6px 0 #111;
          margin: 0;
        }

        .retro-sub-title {
          font-size: 12px;
          letter-spacing: 3px;
          color: #00ffff;
          margin-top: 4px;
          text-transform: uppercase;
          text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
        }

        .menu-card {
          background: #111728;
          border: 3px solid #2f3e69;
          border-radius: 12px;
          padding: 20px 28px;
          width: 92%;
          max-width: 820px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), inset 0 0 20px rgba(0, 210, 255, 0.05);
          position: relative;
          z-index: 1001;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .menu-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #7b8fae;
          margin-bottom: 6px;
          font-weight: bold;
        }

        .tab-group {
          display: flex;
          gap: 8px;
        }

        .tab-btn {
          flex: 1;
          background: #1b233a;
          color: #bdc3c7;
          border: 2px solid #2b395d;
          border-radius: 6px;
          padding: 8px 10px;
          font-family: inherit;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .tab-btn:hover {
          background: #273455;
          color: #fff;
          border-color: #00ffff;
        }

        .tab-btn.active {
          background: #e74c3c;
          border-color: #f1c40f;
          color: #fff;
          box-shadow: 0 0 14px rgba(231, 76, 60, 0.6);
        }

        .showcase-container {
          background: radial-gradient(circle at center, #1b243b 0%, #0c101c 100%);
          border: 2px solid #00d2ff;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 0 15px rgba(0, 210, 255, 0.2);
        }

        #menu-car-canvas {
          width: 100%;
          height: 180px;
          display: block;
        }

        .car-selector-nav {
          display: flex;
          width: 100%;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: rgba(10, 14, 25, 0.8);
          border-top: 1px solid #233152;
        }

        .car-name-badge {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }

        .car-desc-text {
          font-size: 10px;
          color: #a4b0be;
          text-align: center;
          margin-top: 2px;
          font-style: italic;
        }

        .car-stat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .stat-bar-bg {
          width: 58%;
          height: 8px;
          background: #14192b;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid #242f4c;
        }

        .stat-bar-fill {
          height: 100%;
          background: #00d2ff;
          box-shadow: 0 0 8px rgba(0, 210, 255, 0.5);
          transition: width 0.3s ease;
        }

        .btn-start-race {
          width: 100%;
          margin-top: 14px;
          background: linear-gradient(180deg, #2ecc71, #27ae60);
          color: #fff;
          border: none;
          padding: 14px;
          font-family: inherit;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          border-radius: 8px;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(46, 204, 113, 0.4);
          transition: all 0.15s ease;
        }

        .btn-start-race:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(46, 204, 113, 0.6);
        }

        .btn-start-race:disabled {
          background: #555;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
          color: #888;
        }

        .menu-footer-nav {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }

        .btn-sub-nav {
          flex: 1;
          background: #1e263d;
          color: #8fa0c0;
          border: 1px solid #33436d;
          border-radius: 6px;
          padding: 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-sub-nav:hover {
          background: #2a375a;
          color: #f1c40f;
          border-color: #f1c40f;
        }

        .sub-screen-card {
          background: #0f1424;
          border: 2px solid #00ffff;
          border-radius: 10px;
          padding: 24px;
          max-height: 440px;
          overflow-y: auto;
          line-height: 1.6;
        }

        .sub-screen-title {
          font-size: 22px;
          color: #f1c40f;
          font-weight: bold;
          margin-bottom: 14px;
          text-align: center;
          text-transform: uppercase;
        }

        .btn-back-menu {
          background: #e74c3c;
          color: #fff;
          border: none;
          padding: 12px 24px;
          font-family: inherit;
          font-size: 14px;
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 16px;
          display: block;
          width: 100%;
          transition: all 0.15s;
        }

        .btn-back-menu:hover {
          background: #c0392b;
          box-shadow: 0 0 12px rgba(231, 76, 60, 0.6);
        }

        .lan-box {
          background: #0a0e1c;
          border: 1px solid #00d2ff;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .room-controls-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .room-input {
          flex: 1;
          background: #0c101c;
          border: 2px solid #283759;
          border-radius: 6px;
          padding: 8px 12px;
          color: #00ffff;
          font-family: inherit;
          font-size: 14px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          outline: none;
        }

        .room-input:focus {
          border-color: #00d2ff;
          box-shadow: 0 0 8px rgba(0, 210, 255, 0.4);
        }

        .status-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .status-connected { background: #27ae60; color: #fff; }
        .status-connecting { background: #f39c12; color: #fff; }
        .status-reconnecting { background: #e67e22; color: #fff; }
        .status-disconnected { background: #7f8c8d; color: #fff; }
        .status-failed { background: #c0392b; color: #fff; }

        .player-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #161e33;
          border: 1px solid #27375e;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 8px;
        }

        .track-selector-nav {
          background: #0c101c;
          border: 2px solid #283759;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.6);
        }
      </style>

      <div class="menu-title-box">
        <h1 class="retro-main-title">TOP GEAR: LEGADO</h1>
        <div class="retro-sub-title">★ 16-BIT RETRO ARCADE RACING ★</div>
      </div>

      <!-- PAINEL PRINCIPAL DO MENU -->
      <div id="tab-content-main" class="menu-card">
        <div class="menu-grid">
          <!-- Coluna Esquerda: Showcase 3D Girando -->
          <div>
            <div class="menu-label">Veículo Selecionado (3D Turntable)</div>
            <div class="showcase-container">
              <canvas id="menu-car-canvas"></canvas>
              <div class="car-selector-nav">
                <button class="tab-btn" style="flex: 0 0 36px; padding: 4px;" id="btn-prev-car">◀</button>
                <div style="text-align: center;">
                  <div id="menu-car-badge" class="car-name-badge" style="color: #e74c3c;">CANNIBAL</div>
                  <div id="menu-car-desc" class="car-desc-text">Máxima velocidade em retas</div>
                </div>
                <button class="tab-btn" style="flex: 0 0 36px; padding: 4px;" id="btn-next-car">▶</button>
              </div>
            </div>

            <!-- Barras de Atributos -->
            <div style="margin-top: 10px; background: #0c101c; padding: 10px; border-radius: 6px; border: 1px solid #1f2a48;">
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
                <div class="stat-bar-bg"><div id="stat-fuel" class="stat-bar-fill" style="width: 90%; background: #e74c3c;"></div></div>
              </div>
            </div>
          </div>

          <!-- Coluna Direita: Modo, Pista, Dificuldade e Largada -->
          <div style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <!-- Modo de Jogo -->
              <div style="margin-bottom: 10px;">
                <div class="menu-label">Modo de Jogo</div>
                <div class="tab-group" id="group-mode">
                  <button class="tab-btn active" data-mode="race">🏆 Corrida vs IA</button>
                  <button class="tab-btn" data-mode="timeattack">⏱️ Time Attack</button>
                  <button class="tab-btn" data-mode="multiplayer" style="border-color: #00ffff; color: #00ffff;">🌐 Online / P2P</button>
                </div>
              </div>

              <!-- Seletor Visual de Pista -->
              <div style="margin-bottom: 10px;">
                <div class="menu-label">Circuito & Pista Oficial</div>
                <div class="track-selector-nav">
                  <button class="tab-btn" style="flex: 0 0 34px; padding: 6px 2px; font-size: 14px;" id="btn-prev-track">◀</button>
                  <div style="text-align: center; flex: 1; margin: 0 8px; overflow: hidden;">
                    <div id="menu-track-badge" style="font-size: 13px; font-weight: 900; letter-spacing: 1px; color: #f1c40f; text-shadow: 0 0 8px rgba(241, 196, 15, 0.4); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      🇺🇸 LAS VEGAS SUNSET SPEEDWAY
                    </div>
                    <div id="menu-track-info" style="font-size: 10px; color: #00ffff; margin-top: 3px; display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
                      <span id="menu-track-country">Estados Unidos</span>
                      <span>•</span>
                      <span id="menu-track-difficulty" style="color: #2ecc71; font-weight: bold;">Fácil</span>
                      <span>•</span>
                      <span id="menu-track-length" style="color: #f5f6fa;">963m</span>
                    </div>
                    <div id="menu-track-desc" style="font-size: 9px; color: #8fa0c0; margin-top: 2px; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                      Pôr do sol iluminando a strip de cassinos no deserto de Nevada
                    </div>
                  </div>
                  <button class="tab-btn" style="flex: 0 0 34px; padding: 6px 2px; font-size: 14px;" id="btn-next-track">▶</button>
                </div>
              </div>

              <!-- Dificuldade -->
              <div style="margin-bottom: 10px;" id="row-difficulty">
                <div class="menu-label">Dificuldade da IA</div>
                <div class="tab-group" id="group-diff">
                  <button class="tab-btn" data-diff="amateur">Amador</button>
                  <button class="tab-btn active" data-diff="pro">Pro</button>
                  <button class="tab-btn" data-diff="championship">Campeão</button>
                </div>
              </div>

              <!-- Dicas Rápidas -->
              <div style="background: #0d1222; border: 1px dashed #2f4370; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #8aa0c4;">
                <div>🎮 <b>Controles</b>: [W/▲] Acelerar • [S/▼] Freio/Ré</div>
                <div>↔️ <b>Direção</b>: [A/D/◄/►] Esterço • [SHIFT/N] Nitro</div>
                <div>⚡ <b>Vácuo</b>: Fique colado atrás para ganhar +20% de velocidade!</div>
                <div>⛽ <b>Boxes</b>: Pare na faixa iluminada para abastecer</div>
              </div>
            </div>

            <!-- Botão Iniciar -->
            <button id="btn-start" class="btn-start-race">🏁 LARGADA (ENTER)</button>
          </div>
        </div>

        <!-- Rodapé do Menu: Apresentação e Créditos / Fim -->
        <div class="menu-footer-nav">
          <button class="btn-sub-nav" id="btn-show-presentation">📖 Apresentação & Manual</button>
          <button class="btn-sub-nav" id="btn-show-credits">🏆 Fim & Créditos</button>
        </div>
      </div>

      <!-- PAINEL MULTIPLAYER (WebRTC P2P & Relay) -->
      <div id="tab-content-multiplayer" class="menu-card" style="display: none;">
        <div class="sub-screen-card">
          <div class="sub-screen-title">🌐 Multiplayer Online P2P (WebRTC & Relay)</div>

          <!-- Status de Conexão -->
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 11px;">
            <div>Status da Rede: <span id="mp-status-badge" class="status-badge status-disconnected">Desconectado</span></div>
            <div id="mp-status-text" style="color: #8fa0c0; font-size: 11px;">Aguardando ação...</div>
          </div>

          <!-- Ações de Sala (Criar / Entrar) -->
          <div class="room-controls-row">
            <button id="btn-create-p2p" class="tab-btn" style="flex: 1; padding: 10px; background: #27ae60; color: #fff;">
              ✨ Criar Sala (Host)
            </button>
            <input type="text" id="input-room-code" class="room-input" placeholder="CÓDIGO DA SALA" maxlength="8" />
            <button id="btn-join-p2p" class="tab-btn" style="flex: 0 0 130px; padding: 10px; background: #2980b9; color: #fff;">
              🚀 Entrar
            </button>
          </div>

          <!-- Link de Convite Compartilhável -->
          <div class="lan-box" id="box-invite-url">
            <div style="flex: 1; overflow: hidden;">
              <div style="font-size: 10px; color: #8fa0c0; text-transform: uppercase;">Link de Convite Direto para Amigos:</div>
              <div id="mp-url-display" style="font-size: 12px; font-weight: bold; color: #00ffff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                Crie ou entre em uma sala para gerar o link
              </div>
            </div>
            <button id="btn-copy-url" class="tab-btn" style="flex: 0 0 110px; padding: 8px;">📋 Copiar Link</button>
          </div>

          <div class="menu-label">Pilotos Conectados na Sala:</div>
          <div id="mp-players-list">
            <div class="player-row">
              <span>🟢 Você</span>
              <span style="color: #f1c40f;">AGUARDANDO SALA...</span>
            </div>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <button id="btn-mp-ready" class="tab-btn" style="flex: 1; padding: 12px; font-size: 14px; background: #2980b9;">
              ✅ ESTOU PRONTO
            </button>
            <button id="btn-mp-start" class="btn-start-race" style="flex: 1; margin: 0; padding: 12px; font-size: 14px;" disabled>
              🏁 LARGADA MULTIPLAYER
            </button>
          </div>

          <button class="btn-back-menu" id="btn-back-from-mp">⬅️ VOLTAR AO MENU (ESC)</button>
        </div>
      </div>

      <!-- PAINEL DE APRESENTAÇÃO -->
      <div id="tab-content-presentation" class="menu-card" style="display: none;">
        <div class="sub-screen-card">
          <div class="sub-screen-title">📖 Apresentação & Manual do Piloto</div>
          <p style="color: #00ffff; font-weight: bold; margin-bottom: 8px;">Bem-vindo ao Top Gear: Legado!</p>
          <p>
            Inspirado no lendário clássico de corrida dos anos 90, o <b>Top Gear: Legado</b> recria a emoção de alta velocidade arcade com física determinística a 60 Hz, simulação de consumo de combustível, pit stops estratégicos e colisões intensas entre pilotos.
          </p>

          <h3 style="color: #f1c40f; margin-top: 14px; margin-bottom: 6px;">🏎️ Dicas de Pilotagem Arcade:</h3>
          <ul style="padding-left: 20px; font-size: 12px; color: #dcdde1;">
            <li><b>Vácuo Aerodinâmico (*Slipstream*)</b>: Andar colado atrás de outro carro reduz o arrasto e confere até +20% de aceleração.</li>
            <li><b>Gestão de Nitro</b>: Você tem 3 cargas por volta. Use na longa <i>Reta do Deserto</i> para ultrapassagens fulminantes.</li>
            <li><b>Colisão & Bloqueio</b>: Os carros possuem colisão física arcade. Bater na traseira ou empurrar adversários afeta a trajetória de ambos!</li>
            <li><b>Estratégia de Pit Stop</b>: Entre na faixa de boxes iluminada por lasers holográficos para reabastecer rapidamente.</li>
          </ul>

          <button class="btn-back-menu" id="btn-back-from-presentation">⬅️ VOLTAR AO MENU (ESC)</button>
        </div>
      </div>

      <!-- PAINEL DE FIM E CRÉDITOS -->
      <div id="tab-content-credits" class="menu-card" style="display: none;">
        <div class="sub-screen-card" style="text-align: center;">
          <div class="sub-screen-title">🏆 Top Gear: Legado — Fim & Créditos</div>
          <p style="color: #f1c40f; font-size: 16px; font-weight: 900; margin-bottom: 12px;">OBRIGADO POR JOGAR!</p>
          
          <div style="font-size: 12px; color: #ced6e0; line-height: 1.8;">
            <p><b>Desenvolvimento & Física Web Arcade</b><br/>Equipe Top Gear Legado</p>
            <p><b>Design 3D & Efeitos Procedurais</b><br/>Three.js + Shaders Retrô</p>
            <p><b>Multiplayer em Tempo Real</b><br/>WebRTC P2P + WebSocket Low Latency Engine</p>
            <p><b>Homenagem Especial</b><br/>A todos os fãs de jogos de corrida 16-bit dos anos 90</p>
          </div>

          <button class="btn-back-menu" id="btn-back-from-credits">⬅️ VOLTAR AO MENU (ESC)</button>
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
        textEl.style.color = isError ? '#e74c3c' : '#00ffff';
      }
    };

    this.mpClient.onConnectionStatusChangeCallback = (status) => {
      const badgeEl = this.overlay.querySelector<HTMLSpanElement>('#mp-status-badge');
      if (badgeEl) {
        badgeEl.className = `status-badge status-${status}`;
        const labels: Record<string, string> = {
          connected: '🟢 Conectado',
          connecting: '🟡 Conectando...',
          reconnecting: '🟠 Reconectando...',
          disconnected: '⚪ Desconectado',
          failed: '🔴 Erro de Rede',
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
    this.mpClient.joinP2PRoom(roomCode, 'Piloto Desafiante', car.id).catch((err) => {
      console.warn('[WebRTC Join Error]', err);
    });
  }

  private renderMultiplayerLobby(players: NetworkPlayerInfo[], canStart: boolean, roomCode?: string): void {
    const listEl = this.overlay.querySelector<HTMLDivElement>('#mp-players-list');
    const startBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-start');
    const urlDisplay = this.overlay.querySelector<HTMLDivElement>('#mp-url-display');
    const inputRoom = this.overlay.querySelector<HTMLInputElement>('#input-room-code');

    const effectiveRoomCode = roomCode || this.mpClient.roomCode;
    if (effectiveRoomCode) {
      const inviteUrl = this.mpClient.getInviteUrl() || `${window.location.origin}/?join=${effectiveRoomCode}`;
      if (urlDisplay) {
        urlDisplay.textContent = inviteUrl;
      }
      if (inputRoom && !inputRoom.value) {
        inputRoom.value = effectiveRoomCode;
      }
    }

    if (listEl) {
      listEl.innerHTML = players
        .map((p) => {
          const isMe = p.id === this.mpClient.playerId || (this.mpClient.isHost && p.isHost) || (!this.mpClient.isHost && !p.isHost);
          const statusText = p.ready ? '🟢 PRONTO' : '🟡 AGUARDANDO...';
          return `
            <div class="player-row" style="${isMe ? 'border-color: #00d2ff;' : ''}">
              <span>${p.name} ${isMe ? '<b>(Você)</b>' : ''} — <span style="color: #f1c40f;">${p.carId.toUpperCase()}</span></span>
              <span style="font-weight: bold; font-size: 11px;">${statusText}</span>
            </div>
          `;
        })
        .join('');
    }

    if (startBtn) {
      startBtn.disabled = !(this.mpClient.isHost && canStart);
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
  }

  private bindEvents(): void {
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

    // Navegação de Pistas (Botões ◀ / ▶)
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

    // Navegação de Carros
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
        this.mpClient.createP2PRoom('Piloto 1 (Host)', car.id).catch((err) => {
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
        btnCopy.textContent = '✅ Copiado!';
        setTimeout(() => {
          btnCopy.textContent = '📋 Copiar Link';
        }, 2000);
      };
    }

    const btnReady = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-ready');
    if (btnReady) {
      btnReady.onclick = () => {
        this.isMpReady = !this.isMpReady;
        btnReady.textContent = this.isMpReady ? '❌ CANCELAR PRONTO' : '✅ ESTOU PRONTO';
        btnReady.style.background = this.isMpReady ? '#e74c3c' : '#2980b9';
        const car = ALL_CARS[this.selectedCarIndex];
        this.mpClient.setReady(this.isMpReady, car.id);
      };
    }

    const btnMpStart = this.overlay.querySelector<HTMLButtonElement>('#btn-mp-start');
    if (btnMpStart) {
      btnMpStart.onclick = () => {
        if (this.networkPlayers.length < 2) {
          alert('Aguarde seu amigo entrar na sala e ficar PRONTO antes de iniciar a largada!');
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
    if (btnBackMp) btnBackMp.onclick = () => {
      this.mpClient.disconnect();
      this.setTab('main');
    };
  }

  private updateTrackDisplay(): void {
    const track: TrackDefinition = ALL_TRACKS[this.selectedTrackIndex] || ALL_TRACKS[0];
    const badge = this.overlay.querySelector<HTMLDivElement>('#menu-track-badge');
    const country = this.overlay.querySelector<HTMLSpanElement>('#menu-track-country');
    const diff = this.overlay.querySelector<HTMLSpanElement>('#menu-track-difficulty');
    const len = this.overlay.querySelector<HTMLSpanElement>('#menu-track-length');
    const desc = this.overlay.querySelector<HTMLDivElement>('#menu-track-desc');

    const diffColors: Record<string, string> = {
      'Fácil': '#2ecc71',
      'Médio': '#f39c12',
      'Difícil': '#e67e22',
      'Extremo': '#e74c3c',
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
      diff.style.color = diffColors[track.difficulty] || '#00ffff';
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
      night_viper: 'Superbike Bônus: Aceleração insana e máxima agilidade',
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

    if (this.currentTab === 'multiplayer' && this.mpClient.isConnected) {
      this.mpClient.setReady(this.isMpReady, car.id);
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.isVisible) return;

    if (e.code === 'Escape') {
      if (this.currentTab !== 'main') {
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
        soundSystem.playBeep(620);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.selectedCarIndex = (this.selectedCarIndex + 1) % ALL_CARS.length;
        this.updateCarDisplay();
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
