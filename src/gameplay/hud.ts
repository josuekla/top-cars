import type { CarStats, SurfaceType, VehicleState } from "../core";
import type { FuelState, NitroState } from "./index";
import type { LapTrackerState } from "../race";

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
    this.overlay = document.createElement("div");
    this.overlay.id = "retro-hud-overlay";
    this.setupLayout();
    this.container.appendChild(this.overlay);
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
          padding: 16px 24px;
          font-family: 'Courier New', monospace, sans-serif;
          color: #fff;
          user-select: none;
          z-index: 100;
        }
        .hud-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .hud-bottom {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .hud-card {
          background: rgba(10, 15, 29, 0.88);
          border: 2px solid #233152;
          border-radius: 8px;
          padding: 8px 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        .hud-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #8899a6;
          margin-bottom: 2px;
        }
        .hud-value-large {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .hud-bar-bg {
          width: 130px;
          height: 9px;
          background: #111;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 4px;
          border: 1px solid #444;
        }
        .hud-bar-fill {
          height: 100%;
          width: 100%;
          transition: width 0.1s ease-out;
        }
        .nitro-charge-dot {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #00d2ff;
          margin-right: 4px;
          box-shadow: 0 0 6px #00d2ff;
        }
        .nitro-charge-dot.empty {
          background: #333;
          box-shadow: none;
        }
        .pit-alert {
          position: absolute;
          top: 32%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(231, 76, 60, 0.95);
          color: #fff;
          font-size: 18px;
          font-weight: 900;
          padding: 12px 28px;
          border-radius: 8px;
          border: 2px solid #f1c40f;
          box-shadow: 0 0 25px rgba(231, 76, 60, 0.9);
          animation: pulse 0.5s infinite alternate;
          display: none;
          text-align: center;
        }
        .pit-guiding-banner {
          position: absolute;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(243, 156, 18, 0.92);
          color: #000;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
          padding: 6px 18px;
          border-radius: 20px;
          border: 2px solid #fff;
          box-shadow: 0 0 15px rgba(243, 156, 18, 0.8);
          display: none;
        }
        .slipstream-banner {
          position: absolute;
          top: 96px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 210, 255, 0.92);
          color: #000;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1.5px;
          padding: 5px 16px;
          border-radius: 16px;
          border: 2px solid #fff;
          box-shadow: 0 0 16px rgba(0, 210, 255, 0.9);
          display: none;
          animation: pulse 0.4s infinite alternate;
        }
        .gear-badge {
          display: inline-block;
          background: #e74c3c;
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 6px;
        }
        @keyframes pulse {
          from { transform: translate(-50%, -50%) scale(1); }
          to { transform: translate(-50%, -50%) scale(1.06); }
        }
      </style>

      <div class="hud-top">
        <div class="hud-card">
          <div class="hud-title">Posição</div>
          <div id="hud-pos" class="hud-value-large" style="color: #f1c40f;">1º / 4</div>
          <div id="hud-lap" style="color: #fff; font-size: 13px; font-weight: bold; margin-top: 4px;">VOLTA 1/3</div>
        </div>

        <!-- Minimapa Container (Top Center/Right) -->
        <div id="hud-minimap-mount"></div>

        <div class="hud-card" style="text-align: right;">
          <div class="hud-title">Tempo de Volta</div>
          <div id="hud-time" style="font-size: 20px; font-weight: bold; color: #fff;">00:00.00</div>
          <div id="hud-best" style="font-size: 12px; color: #9b59b6; margin-top: 2px;">RECORD: --:--.--</div>
        </div>
      </div>

      <!-- Alertas Dinâmicos de Vácuo e Pit Stop -->
      <div id="hud-slipstream" class="slipstream-banner">⚡ SLIPSTREAM (VÁCUO ATIVO) +18% VELOCIDADE!</div>
      <div id="hud-pit-guide" class="pit-guiding-banner">⛽ PIT STOP NA RETA DOS BOXES ➔ FAIXA À ESQUERDA ⬅️ </div>
      <div id="hud-pit-alert" class="pit-alert">⛽ BOXES: REABASTECENDO COMBUSTÍVEL... ⚡</div>

      <div class="hud-bottom">
        <!-- Carro e Combustível -->
        <div class="hud-card">
          <div id="hud-car-name" class="hud-title" style="color: #e74c3c; font-weight: bold;">Cannibal</div>
          <div class="hud-title">Combustível</div>
          <div class="hud-bar-bg">
            <div id="hud-fuel-bar" class="hud-bar-fill" style="background: #3498db; width: 100%;"></div>
          </div>
          <div id="hud-fuel-text" style="font-size: 11px; margin-top: 2px; color: #bdc3c7;">100%</div>
        </div>

        <!-- Velocímetro Digital com Marcha e Tacômetro RPM -->
        <div class="hud-card" style="text-align: center; min-width: 160px;">
          <div class="hud-title">Velocidade & Marcha</div>
          <div style="display: flex; align-items: baseline; justify-content: center; gap: 4px;">
            <span id="hud-speed" class="hud-value-large" style="color: #00ffff;">0</span>
            <span style="font-size: 11px; color: #7f8c8d; font-weight: bold;">km/h</span>
            <span id="hud-gear" class="gear-badge">1ª</span>
          </div>
          <!-- Barra de Tacômetro RPM -->
          <div class="hud-bar-bg" style="width: 100%; height: 6px; margin-top: 4px;">
            <div id="hud-rpm-bar" class="hud-bar-fill" style="background: #2ecc71; width: 20%;"></div>
          </div>
          <div id="hud-surface" style="font-size: 10px; color: #95a5a6; margin-top: 2px;">Asfalto</div>
        </div>

        <!-- Nitro Boost -->
        <div class="hud-card" style="text-align: right;">
          <div class="hud-title">Nitro Boost</div>
          <div id="hud-nitro-dots" style="margin-top: 4px;">
            <span class="nitro-charge-dot"></span>
            <span class="nitro-charge-dot"></span>
            <span class="nitro-charge-dot"></span>
          </div>
          <div id="hud-nitro-status" style="font-size: 11px; color: #00d2ff; margin-top: 4px; font-weight: bold;">
            [SHIFT] 3 DISPONÍVEIS
          </div>
        </div>
      </div>
    `;
  }

  public update(data: HUDUpdateData): void {
    const speedKmh = Math.round(data.vehicleState.speed * 3.6);
    const speedRatio = Math.min(
      1.0,
      Math.max(0, data.vehicleState.speed / data.carStats.topSpeed),
    );

    // Marcha virtual (1ª a 6ª)
    const gear = Math.min(6, Math.max(1, Math.floor(speedRatio * 5.8) + 1));
    const hudGear = this.overlay.querySelector<HTMLSpanElement>("#hud-gear");
    if (hudGear) {
      hudGear.textContent = `${gear}ª`;
    }

    // Tacômetro de RPM
    const rpmInGear = ((speedRatio * 6) % 1) * 0.7 + 0.3;
    const hudRpmBar =
      this.overlay.querySelector<HTMLDivElement>("#hud-rpm-bar");
    if (hudRpmBar) {
      const rpmPct = Math.round(rpmInGear * 100);
      hudRpmBar.style.width = `${rpmPct}%`;
      hudRpmBar.style.background =
        rpmPct > 85 ? "#e74c3c" : rpmPct > 65 ? "#f1c40f" : "#2ecc71";
    }

    // Velocidade
    const hudSpeed = this.overlay.querySelector<HTMLDivElement>("#hud-speed");
    if (hudSpeed) {
      hudSpeed.textContent = `${speedKmh}`;
      if (data.nitro.isActive) {
        hudSpeed.style.color = "#f1c40f";
      } else if (data.inSlipstream) {
        hudSpeed.style.color = "#00ffff";
      } else if (data.vehicleState.isOutOfFuel) {
        hudSpeed.style.color = "#e74c3c";
      } else {
        hudSpeed.style.color = "#00ffff";
      }
    }

    // Banner de Vácuo (Slipstream)
    const slipBanner =
      this.overlay.querySelector<HTMLDivElement>("#hud-slipstream");
    if (slipBanner) {
      slipBanner.style.display = data.inSlipstream ? "block" : "none";
    }

    // Posição & Volta
    const hudPos = this.overlay.querySelector<HTMLDivElement>("#hud-pos");
    if (hudPos) {
      hudPos.textContent = `${data.position}º / ${data.totalRacers}`;
    }

    const hudLap = this.overlay.querySelector<HTMLDivElement>("#hud-lap");
    if (hudLap) {
      hudLap.textContent = data.lap.isFinished
        ? "FINALIZADO!"
        : `VOLTA ${Math.min(data.lap.totalLaps, data.lap.currentLap)}/${data.lap.totalLaps}`;
    }

    // Tempos
    const hudTime = this.overlay.querySelector<HTMLDivElement>("#hud-time");
    if (hudTime) {
      hudTime.textContent = this.formatTime(data.lap.currentLapTime);
    }

    const hudBest = this.overlay.querySelector<HTMLDivElement>("#hud-best");
    if (hudBest) {
      hudBest.textContent = `RECORD: ${data.lap.bestLapTime ? this.formatTime(data.lap.bestLapTime) : "--:--.--"}`;
    }

    // Combustível
    const fuelPct = Math.max(
      0,
      Math.min(100, Math.round((data.fuel.current / data.fuel.max) * 100)),
    );
    const fuelBar = this.overlay.querySelector<HTMLDivElement>("#hud-fuel-bar");
    const fuelText =
      this.overlay.querySelector<HTMLDivElement>("#hud-fuel-text");

    if (fuelBar) {
      fuelBar.style.width = `${fuelPct}%`;
      fuelBar.style.background = data.fuel.isEmpty
        ? "#555"
        : data.fuel.isLow
          ? "#e74c3c"
          : fuelPct < 50
            ? "#f39c12"
            : "#3498db";
    }

    if (fuelText) {
      fuelText.textContent = data.fuel.isEmpty
        ? "SEM COMBUSTÍVEL (CRAWL)"
        : data.fuel.isLow
          ? `AVISO: ${fuelPct}%`
          : `${fuelPct}%`;
      fuelText.style.color = data.fuel.isLow ? "#e74c3c" : "#bdc3c7";
    }

    // Nitro
    const nitroDots =
      this.overlay.querySelector<HTMLDivElement>("#hud-nitro-dots");
    if (nitroDots) {
      let dotsHtml = "";
      for (let i = 0; i < data.nitro.maxCharges; i++) {
        const isFilled = i < data.nitro.charges;
        dotsHtml += `<span class="nitro-charge-dot ${isFilled ? "" : "empty"}"></span>`;
      }
      nitroDots.innerHTML = dotsHtml;
    }

    const nitroStatus =
      this.overlay.querySelector<HTMLDivElement>("#hud-nitro-status");
    if (nitroStatus) {
      if (data.nitro.isActive) {
        nitroStatus.textContent = `TURBO ATIVO (${data.nitro.timer.toFixed(1)}s)`;
        nitroStatus.style.color = "#f1c40f";
      } else if (data.nitro.charges > 0) {
        nitroStatus.textContent = `[SHIFT] ${data.nitro.charges} DISPONÍVEIS`;
        nitroStatus.style.color = "#00d2ff";
      } else {
        nitroStatus.textContent = "ESGOTADO";
        nitroStatus.style.color = "#7f8c8d";
      }
    }

    // Superfície & Alertas de Pit Stop
    const hudSurface =
      this.overlay.querySelector<HTMLDivElement>("#hud-surface");
    const pitAlert =
      this.overlay.querySelector<HTMLDivElement>("#hud-pit-alert");
    const pitGuide =
      this.overlay.querySelector<HTMLDivElement>("#hud-pit-guide");

    if (data.surface === "pit") {
      if (hudSurface) hudSurface.textContent = "Boxes (Pit Lane)";
      if (pitAlert) {
        pitAlert.style.display = "block";
        pitAlert.textContent = `⛽ PIT STOP: REABASTECENDO (${fuelPct}%) ⚡`;
      }
      if (pitGuide) pitGuide.style.display = "none";
    } else if (data.surface === "grass") {
      if (hudSurface) hudSurface.textContent = "Grama (Off-Track)";
      if (pitAlert) pitAlert.style.display = "none";
      if (pitGuide) pitGuide.style.display = data.fuel.isLow ? "block" : "none";
    } else {
      if (hudSurface) hudSurface.textContent = "Asfalto";
      if (pitAlert) pitAlert.style.display = "none";
      if (pitGuide) {
        pitGuide.style.display = data.fuel.isLow ? "block" : "none";
      }
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds * 100) % 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  }

  public destroy(): void {
    this.overlay.remove();
  }
}
