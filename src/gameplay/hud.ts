import type { CarStats, SurfaceType, VehicleState } from '../core';
import type { FuelState, NitroState } from './index';
import type { LapTrackerState } from '../race';

export interface HUDUpdateData {
  vehicleState: VehicleState;
  carStats: CarStats;
  fuel: FuelState;
  nitro: NitroState;
  lap: LapTrackerState;
  position: number;
  totalRacers: number;
  surface: SurfaceType;
  inSlipstream?: boolean;
}

export class HUD {
  public container: HTMLElement;
  public overlay: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.overlay = document.createElement('div');
    this.overlay.id = 'retro-hud-overlay';
    this.setupLayout();
    this.container.appendChild(this.overlay);
    this.bindEvents();
  }

  private setupLayout(): void {
    this.overlay.innerHTML = `
      <style>
        #retro-hud-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #fff;
          user-select: none;
          z-index: 100;
        }

        .hud-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .hud-bottom {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
        }

        .hud-pill {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 8px 14px;
          box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
          pointer-events: auto;
        }

        /* Topo Esquerdo: Posição e Volta */
        .hud-pos-lap-card {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .hud-pos-val {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 24px;
          font-weight: 900;
          color: #f1c40f;
          letter-spacing: 0.5px;
          line-height: 1;
        }

        .hud-divider {
          color: rgba(255, 255, 255, 0.2);
          font-size: 14px;
        }

        .hud-lap-val {
          font-size: 13px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: 1px;
          line-height: 1;
        }

        /* Topo Centro: Minimapa */
        .hud-minimap-wrapper {
          display: flex;
          justify-content: center;
          pointer-events: auto;
        }

        /* Topo Direito: Tempo e Pausa */
        .hud-top-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hud-timer-card {
          text-align: right;
          min-width: 110px;
        }

        .hud-time-val {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 18px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.5px;
          line-height: 1.1;
        }

        .hud-best-val {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          margin-top: 2px;
          letter-spacing: 0.5px;
        }

        .hud-pause-btn {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #38bdf8;
          border-radius: 10px;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          cursor: pointer;
          backdrop-filter: blur(12px);
          transition: all 0.15s ease;
          pointer-events: auto;
        }

        .hud-pause-btn:hover {
          background: rgba(30, 41, 59, 0.9);
          border-color: #f1c40f;
          color: #f1c40f;
          transform: scale(1.05);
        }

        /* Base Esquerda: Combustível */
        .hud-fuel-card {
          min-width: 140px;
        }

        .hud-fuel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .hud-fuel-title {
          color: #94a3b8;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hud-fuel-pct {
          font-family: 'Courier New', monospace, sans-serif;
          font-weight: 900;
          color: #cbd5e1;
        }

        .hud-bar-slim-bg {
          width: 100%;
          height: 4px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 2px;
          overflow: hidden;
        }

        .hud-bar-slim-fill {
          height: 100%;
          background: #38bdf8;
          border-radius: 2px;
          transition: width 0.15s ease-out, background 0.3s ease;
        }

        /* Base Centro: Velocímetro e Marcha */
        .hud-speedo-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 160px;
          padding: 8px 18px;
        }

        .hud-speed-row {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 6px;
        }

        .hud-speed-val {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 32px;
          font-weight: 900;
          color: #38bdf8;
          letter-spacing: -1px;
          line-height: 1;
        }

        .hud-speed-unit {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
        }

        .hud-gear-badge {
          background: #ef4444;
          color: #fff;
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 12px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 4px;
          line-height: 1;
        }

        .hud-rpm-slim-bg {
          width: 100%;
          height: 3px;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 6px;
        }

        .hud-rpm-slim-fill {
          height: 100%;
          background: #10b981;
          border-radius: 2px;
          transition: width 0.05s linear, background 0.2s ease;
        }

        .hud-surface-tag {
          font-size: 9px;
          color: #64748b;
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Base Direita: Nitro Boost */
        .hud-nitro-card {
          min-width: 130px;
          text-align: right;
        }

        .hud-nitro-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .hud-nitro-title {
          font-weight: 700;
          color: #38bdf8;
          display: flex;
          align-items: center;
          gap: 3px;
        }

        .hud-nitro-status {
          font-family: 'Courier New', monospace, sans-serif;
          font-size: 10px;
          color: #94a3b8;
          font-weight: 700;
        }

        .hud-nitro-capsules {
          display: flex;
          justify-content: flex-end;
          gap: 5px;
        }

        .nitro-cap {
          width: 22px;
          height: 6px;
          border-radius: 3px;
          background: #00d2ff;
          box-shadow: 0 0 8px rgba(0, 210, 255, 0.5);
          transition: all 0.2s ease;
        }

        .nitro-cap.empty {
          background: rgba(51, 65, 85, 0.5);
          box-shadow: none;
        }

        /* Toasts Flutuantes Minimalistas */
        .hud-toast {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          backdrop-filter: blur(8px);
          display: none;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
          z-index: 200;
        }

        .hud-toast-slipstream {
          top: 76px;
          background: rgba(6, 182, 212, 0.85);
          color: #042f2e;
          border: 1px solid rgba(255, 255, 255, 0.4);
        }

        .hud-toast-pit-guide {
          top: 110px;
          background: rgba(245, 158, 11, 0.85);
          color: #451a03;
          border: 1px solid rgba(255, 255, 255, 0.4);
        }

        .hud-toast-pit-alert {
          top: 35%;
          background: rgba(16, 185, 129, 0.9);
          color: #022c22;
          font-size: 15px;
          padding: 10px 24px;
          border: 1px solid #fff;
        }
      </style>

      <div class="hud-top">
        <!-- Topo Esquerdo: Posição e Volta -->
        <div class="hud-pill hud-pos-lap-card">
          <span id="hud-pos" class="hud-pos-val">1º / 4</span>
          <span class="hud-divider">•</span>
          <span id="hud-lap" class="hud-lap-val">VOLTA 1/3</span>
        </div>

        <!-- Topo Centro: Minimapa Mount -->
        <div class="hud-minimap-wrapper">
          <div id="hud-minimap-mount"></div>
        </div>

        <!-- Topo Direito: Tempo de Volta & Botão de Pausa Minimalista -->
        <div class="hud-top-right">
          <div class="hud-pill hud-timer-card">
            <div id="hud-time" class="hud-time-val">00:00.00</div>
            <div id="hud-best" class="hud-best-val">REC --:--.--</div>
          </div>
          <button id="btn-hud-pause" class="hud-pause-btn" title="Pausar Jogo (ESC)">⏸</button>
        </div>
      </div>

      <!-- Banners de Vácuo e Boxes -->
      <div id="hud-slipstream" class="hud-toast hud-toast-slipstream">⚡ VÁCUO ATIVO (+20% VELOCIDADE)</div>
      <div id="hud-pit-guide" class="hud-toast hud-toast-pit-guide">⛽ BOXES À ESQUERDA</div>
      <div id="hud-pit-alert" class="hud-toast hud-toast-pit-alert">⛽ REABASTECENDO COMBUSTÍVEL...</div>

      <div class="hud-bottom">
        <!-- Base Esquerda: Combustível -->
        <div class="hud-pill hud-fuel-card">
          <div class="hud-fuel-header">
            <div class="hud-fuel-title">
              <span>⛽</span>
              <span id="hud-car-name">CANNIBAL</span>
            </div>
            <span id="hud-fuel-text" class="hud-fuel-pct">100%</span>
          </div>
          <div class="hud-bar-slim-bg">
            <div id="hud-fuel-bar" class="hud-bar-slim-fill" style="width: 100%;"></div>
          </div>
        </div>

        <!-- Base Centro: Velocímetro e Marcha -->
        <div class="hud-pill hud-speedo-card">
          <div class="hud-speed-row">
            <span id="hud-speed" class="hud-speed-val">0</span>
            <span class="hud-speed-unit">km/h</span>
            <span id="hud-gear" class="hud-gear-badge">1ª</span>
          </div>
          <div class="hud-rpm-slim-bg">
            <div id="hud-rpm-bar" class="hud-rpm-slim-fill" style="width: 20%;"></div>
          </div>
          <div id="hud-surface" class="hud-surface-tag">Asfalto</div>
        </div>

        <!-- Base Direita: Nitro Boost -->
        <div class="hud-pill hud-nitro-card">
          <div class="hud-nitro-header">
            <div class="hud-nitro-title">
              <span>⚡</span>
              <span>NITRO</span>
            </div>
            <span id="hud-nitro-status" class="hud-nitro-status">3 DISP.</span>
          </div>
          <div id="hud-nitro-dots" class="hud-nitro-capsules">
            <span class="nitro-cap"></span>
            <span class="nitro-cap"></span>
            <span class="nitro-cap"></span>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const pauseBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-hud-pause');
    if (pauseBtn) {
      pauseBtn.onclick = (e) => {
        e.stopPropagation();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
        }
      };
    }
  }

  public update(data: HUDUpdateData): void {
    const speedKmh = Math.round(data.vehicleState.speed * 3.6);
    const speedRatio = Math.min(
      1.0,
      Math.max(0, data.vehicleState.speed / data.carStats.topSpeed)
    );

    // Marcha virtual (1ª a 6ª)
    const gear = Math.min(6, Math.max(1, Math.floor(speedRatio * 5.8) + 1));
    const hudGear = this.overlay.querySelector<HTMLSpanElement>('#hud-gear');
    if (hudGear) {
      hudGear.textContent = `${gear}ª`;
    }

    // Tacômetro de RPM
    const rpmInGear = ((speedRatio * 6) % 1) * 0.7 + 0.3;
    const hudRpmBar = this.overlay.querySelector<HTMLDivElement>('#hud-rpm-bar');
    if (hudRpmBar) {
      const rpmPct = Math.round(rpmInGear * 100);
      hudRpmBar.style.width = `${rpmPct}%`;
      hudRpmBar.style.background =
        rpmPct > 85 ? '#ef4444' : rpmPct > 65 ? '#f59e0b' : '#10b981';
    }

    // Velocidade
    const hudSpeed = this.overlay.querySelector<HTMLDivElement>('#hud-speed');
    if (hudSpeed) {
      hudSpeed.textContent = `${speedKmh}`;
      if (data.nitro.isActive) {
        hudSpeed.style.color = '#f1c40f';
      } else if (data.inSlipstream) {
        hudSpeed.style.color = '#38bdf8';
      } else if (data.vehicleState.isOutOfFuel) {
        hudSpeed.style.color = '#ef4444';
      } else {
        hudSpeed.style.color = '#38bdf8';
      }
    }

    // Nome do Carro
    const hudCarName = this.overlay.querySelector<HTMLSpanElement>('#hud-car-name');
    if (hudCarName) {
      hudCarName.textContent = data.carStats.name.toUpperCase();
      hudCarName.style.color = data.carStats.color;
    }

    // Banner de Vácuo (Slipstream)
    const slipBanner = this.overlay.querySelector<HTMLDivElement>('#hud-slipstream');
    if (slipBanner) {
      slipBanner.style.display = data.inSlipstream ? 'block' : 'none';
    }

    // Posição & Volta
    const hudPos = this.overlay.querySelector<HTMLDivElement>('#hud-pos');
    if (hudPos) {
      hudPos.textContent = `${data.position}º / ${data.totalRacers}`;
    }

    const hudLap = this.overlay.querySelector<HTMLDivElement>('#hud-lap');
    if (hudLap) {
      hudLap.textContent = data.lap.isFinished
        ? 'FINALIZADO!'
        : `VOLTA ${Math.min(data.lap.totalLaps, data.lap.currentLap)}/${data.lap.totalLaps}`;
    }

    // Tempos
    const hudTime = this.overlay.querySelector<HTMLDivElement>('#hud-time');
    if (hudTime) {
      hudTime.textContent = this.formatTime(data.lap.currentLapTime);
    }

    const hudBest = this.overlay.querySelector<HTMLDivElement>('#hud-best');
    if (hudBest) {
      hudBest.textContent = `REC: ${data.lap.bestLapTime ? this.formatTime(data.lap.bestLapTime) : '--:--.--'}`;
    }

    // Combustível
    const fuelPct = Math.max(
      0,
      Math.min(100, Math.round((data.fuel.current / data.fuel.max) * 100))
    );
    const fuelBar = this.overlay.querySelector<HTMLDivElement>('#hud-fuel-bar');
    const fuelText = this.overlay.querySelector<HTMLDivElement>('#hud-fuel-text');

    if (fuelBar) {
      fuelBar.style.width = `${fuelPct}%`;
      fuelBar.style.background = data.fuel.isEmpty
        ? '#64748b'
        : data.fuel.isLow
          ? '#ef4444'
          : fuelPct < 50
            ? '#f59e0b'
            : '#38bdf8';
    }

    if (fuelText) {
      fuelText.textContent = data.fuel.isEmpty
        ? 'SEM GASOLINA'
        : data.fuel.isLow
          ? `AVISO: ${fuelPct}%`
          : `${fuelPct}%`;
      fuelText.style.color = data.fuel.isLow ? '#ef4444' : '#cbd5e1';
    }

    // Nitro
    const nitroDots = this.overlay.querySelector<HTMLDivElement>('#hud-nitro-dots');
    if (nitroDots) {
      let dotsHtml = '';
      for (let i = 0; i < data.nitro.maxCharges; i++) {
        const isFilled = i < data.nitro.charges;
        dotsHtml += `<span class="nitro-cap ${isFilled ? '' : 'empty'}"></span>`;
      }
      nitroDots.innerHTML = dotsHtml;
    }

    const nitroStatus = this.overlay.querySelector<HTMLDivElement>('#hud-nitro-status');
    if (nitroStatus) {
      if (data.nitro.isActive) {
        nitroStatus.textContent = `TURBO (${data.nitro.timer.toFixed(1)}s)`;
        nitroStatus.style.color = '#f1c40f';
      } else if (data.nitro.charges > 0) {
        nitroStatus.textContent = `[SHIFT] ${data.nitro.charges} DISP.`;
        nitroStatus.style.color = '#38bdf8';
      } else {
        nitroStatus.textContent = 'ESGOTADO';
        nitroStatus.style.color = '#64748b';
      }
    }

    // Superfície & Alertas de Pit Stop
    const hudSurface = this.overlay.querySelector<HTMLDivElement>('#hud-surface');
    const pitAlert = this.overlay.querySelector<HTMLDivElement>('#hud-pit-alert');
    const pitGuide = this.overlay.querySelector<HTMLDivElement>('#hud-pit-guide');

    if (data.surface === 'pit') {
      if (hudSurface) hudSurface.textContent = 'Boxes (Pit Lane)';
      if (pitAlert) {
        pitAlert.style.display = 'block';
        pitAlert.textContent = `⛽ REABASTECENDO (${fuelPct}%)`;
      }
      if (pitGuide) pitGuide.style.display = 'none';
    } else if (data.surface === 'grass') {
      if (hudSurface) hudSurface.textContent = 'Grama (Off-Track)';
      if (pitAlert) pitAlert.style.display = 'none';
      if (pitGuide) pitGuide.style.display = data.fuel.isLow ? 'block' : 'none';
    } else {
      if (hudSurface) hudSurface.textContent = 'Asfalto';
      if (pitAlert) pitAlert.style.display = 'none';
      if (pitGuide) {
        pitGuide.style.display = data.fuel.isLow ? 'block' : 'none';
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds * 100) % 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  }

  public destroy(): void {
    this.overlay.remove();
  }
}
