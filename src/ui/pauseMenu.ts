import { soundSystem } from '../audio';

export interface PauseMenuOptions {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onPause?: () => void;
}

export class PauseMenu {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private pauseButton: HTMLButtonElement;
  private options: PauseMenuOptions;
  private _isPaused: boolean = false;
  private selectedButtonIndex: number = 0;
  private buttons: HTMLButtonElement[] = [];

  constructor(container: HTMLElement, options: PauseMenuOptions) {
    this.container = container;
    this.options = options;

    // 1. Botão flutuante no topo direito [⏸️ PAUSAR]
    this.pauseButton = document.createElement('button');
    this.pauseButton.id = 'btn-hud-pause-trigger';
    this.pauseButton.innerHTML = '⏸️ PAUSAR';
    this.setupPauseButton();
    this.container.appendChild(this.pauseButton);

    // 2. Modal Overlay de Pausa
    this.overlay = document.createElement('div');
    this.overlay.id = 'retro-pause-overlay';
    this.setupLayout();
    this.container.appendChild(this.overlay);

    this.bindEvents();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleKeyDown);
    }
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  private setupPauseButton(): void {
    this.pauseButton.style.cssText = `
      position: fixed;
      top: 18px;
      right: 20px;
      z-index: 500;
      background: linear-gradient(180deg, #1b263b 0%, #0d1322 100%);
      color: #00ffff;
      border: 2px solid #00d2ff;
      border-radius: 8px;
      padding: 8px 16px;
      font-family: 'Courier New', monospace, sans-serif;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1.5px;
      cursor: pointer;
      box-shadow: 0 0 14px rgba(0, 210, 255, 0.4), inset 0 0 8px rgba(0, 210, 255, 0.1);
      display: none;
      user-select: none;
      transition: all 0.15s ease;
      pointer-events: auto;
    `;

    this.pauseButton.onmouseenter = () => {
      this.pauseButton.style.transform = 'scale(1.05)';
      this.pauseButton.style.borderColor = '#f1c40f';
      this.pauseButton.style.color = '#f1c40f';
      this.pauseButton.style.boxShadow = '0 0 20px rgba(241, 196, 15, 0.6)';
    };

    this.pauseButton.onmouseleave = () => {
      this.pauseButton.style.transform = 'scale(1)';
      this.pauseButton.style.borderColor = '#00d2ff';
      this.pauseButton.style.color = '#00ffff';
      this.pauseButton.style.boxShadow = '0 0 14px rgba(0, 210, 255, 0.4)';
    };

    this.pauseButton.onclick = (e) => {
      e.stopPropagation();
      this.toggle();
    };
  }

  private setupLayout(): void {
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = `
      <style>
        #retro-pause-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, rgba(14, 20, 38, 0.94) 0%, rgba(4, 7, 15, 0.98) 100%);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: 'Courier New', monospace, sans-serif;
          color: #fff;
          user-select: none;
        }

        #retro-pause-overlay::before {
          content: " ";
          display: block;
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%);
          background-size: 100% 4px;
          z-index: 10001;
          pointer-events: none;
          opacity: 0.75;
        }

        .pause-card {
          background: #0e1424;
          border: 3px solid #00d2ff;
          border-radius: 12px;
          padding: 32px 36px;
          width: 90%;
          max-width: 480px;
          box-shadow: 0 0 40px rgba(0, 210, 255, 0.4), inset 0 0 25px rgba(0, 210, 255, 0.08);
          position: relative;
          z-index: 10002;
          text-align: center;
          animation: pauseCardPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes pauseCardPop {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .pause-title {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 4px;
          color: #f1c40f;
          text-shadow: 0 0 16px rgba(241, 196, 15, 0.8), 2px 2px 0 #c0392b;
          margin-bottom: 4px;
        }

        .pause-subtitle {
          font-size: 11px;
          letter-spacing: 2px;
          color: #00ffff;
          text-transform: uppercase;
          margin-bottom: 26px;
          text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
        }

        .pause-button-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .btn-pause-action {
          width: 100%;
          padding: 14px 18px;
          font-family: inherit;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
          border-radius: 8px;
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .btn-pause-resume {
          background: linear-gradient(180deg, #2ecc71, #27ae60);
          color: #fff;
          border-color: #2ecc71;
          box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);
        }

        .btn-pause-resume:hover, .btn-pause-resume.focused {
          background: linear-gradient(180deg, #27ae60, #2ecc71);
          transform: translateY(-2px) scale(1.02);
          border-color: #fff;
          box-shadow: 0 0 22px rgba(46, 204, 113, 0.8);
        }

        .btn-pause-restart {
          background: linear-gradient(180deg, #f39c12, #d35400);
          color: #fff;
          border-color: #f39c12;
          box-shadow: 0 4px 15px rgba(243, 156, 18, 0.4);
        }

        .btn-pause-restart:hover, .btn-pause-restart.focused {
          background: linear-gradient(180deg, #d35400, #f39c12);
          transform: translateY(-2px) scale(1.02);
          border-color: #fff;
          box-shadow: 0 0 22px rgba(243, 156, 18, 0.8);
        }

        .btn-pause-main {
          background: linear-gradient(180deg, #c0392b, #962d22);
          color: #fff;
          border-color: #e74c3c;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
        }

        .btn-pause-main:hover, .btn-pause-main.focused {
          background: linear-gradient(180deg, #962d22, #c0392b);
          transform: translateY(-2px) scale(1.02);
          border-color: #fff;
          box-shadow: 0 0 22px rgba(231, 76, 60, 0.8);
        }

        .pause-hints {
          margin-top: 22px;
          font-size: 11px;
          color: #7b8fae;
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .pause-hints span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
      </style>

      <div class="pause-card">
        <div class="pause-title">⏸️ PAUSA</div>
        <div class="pause-subtitle">TOP GEAR: LEGADO • CORRIDA EM ANDAMENTO</div>

        <div class="pause-button-group">
          <button id="btn-pause-resume" class="btn-pause-action btn-pause-resume">
            ▶ CONTINUAR CORRIDA
          </button>
          <button id="btn-pause-restart" class="btn-pause-action btn-pause-restart">
            🔄 REINICIAR PROVA
          </button>
          <button id="btn-pause-main" class="btn-pause-action btn-pause-main">
            🏠 VOLTAR AO MENU PRINCIPAL
          </button>
        </div>

        <div class="pause-hints">
          <span>🎮 <b>[ESC]</b> Retomar</span>
          <span>•</span>
          <span>🔼🔽 <b>[SETAS]</b> Navegar</span>
          <span>•</span>
          <span>⚡ <b>[ENTER]</b> Confirmar</span>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const resumeBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-pause-resume');
    const restartBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-pause-restart');
    const mainBtn = this.overlay.querySelector<HTMLButtonElement>('#btn-pause-main');

    this.buttons = [resumeBtn, restartBtn, mainBtn].filter(Boolean) as HTMLButtonElement[];

    if (resumeBtn) {
      resumeBtn.onclick = () => {
        soundSystem.playBeep(660);
        this.resume();
      };
    }

    if (restartBtn) {
      restartBtn.onclick = () => {
        soundSystem.playBeep(520);
        this.restart();
      };
    }

    if (mainBtn) {
      mainBtn.onclick = () => {
        soundSystem.playBeep(440);
        this.mainMenu();
      };
    }
  }

  private updateButtonFocus(): void {
    this.buttons.forEach((btn, index) => {
      if (index === this.selectedButtonIndex) {
        btn.classList.add('focused');
      } else {
        btn.classList.remove('focused');
      }
    });
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this._isPaused) return;

    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      soundSystem.playBeep(660);
      this.resume();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.selectedButtonIndex = (this.selectedButtonIndex + 1) % this.buttons.length;
      this.updateButtonFocus();
      soundSystem.playBeep(480);
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.selectedButtonIndex = (this.selectedButtonIndex - 1 + this.buttons.length) % this.buttons.length;
      this.updateButtonFocus();
      soundSystem.playBeep(480);
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      const currentBtn = this.buttons[this.selectedButtonIndex];
      if (currentBtn) {
        currentBtn.click();
      }
    }
  };

  public show(): void {
    this._isPaused = true;
    this.selectedButtonIndex = 0;
    this.updateButtonFocus();
    this.overlay.style.display = 'flex';
    soundSystem.playBeep(440);
    this.options.onPause?.();
  }

  public hide(): void {
    this._isPaused = false;
    this.overlay.style.display = 'none';
  }

  public toggle(): void {
    if (this._isPaused) {
      this.resume();
    } else {
      this.show();
    }
  }

  public resume(): void {
    this.hide();
    this.options.onResume();
  }

  public restart(): void {
    this.hide();
    this.options.onRestart();
  }

  public mainMenu(): void {
    this.hide();
    this.hidePauseButton();
    this.options.onMainMenu();
  }

  public showPauseButton(): void {
    this.pauseButton.style.display = 'block';
  }

  public hidePauseButton(): void {
    this.pauseButton.style.display = 'none';
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleKeyDown);
    }
    this.pauseButton.remove();
    this.overlay.remove();
  }
}
