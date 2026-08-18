import { soundSystem } from '../audio';

export class AuthGate {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private onUnlockCallback: () => void;
  private readonly defaultPasswords: string[] = ['topgear', 'topgear2026', 'dione', 'dione123', 'admin'];

  constructor(container: HTMLElement, onUnlock: () => void) {
    this.container = container;
    this.onUnlockCallback = onUnlock;
    this.overlay = document.createElement('div');
    this.overlay.id = 'retro-auth-gate-overlay';
    this.setupLayout();
    this.container.appendChild(this.overlay);
  }

  public static isUnlocked(): boolean {
    return localStorage.getItem('topgear_auth_unlocked') === 'true';
  }

  public static lock(): void {
    localStorage.removeItem('topgear_auth_unlocked');
    window.location.reload();
  }

  private setupLayout(): void {
    this.overlay.innerHTML = `
      <style>
        #retro-auth-gate-overlay {
          position: fixed;
          inset: 0;
          background: radial-gradient(circle at center, #111a33 0%, #050811 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          font-family: 'Courier New', monospace, sans-serif;
          color: #fff;
          user-select: none;
        }

        #retro-auth-gate-overlay::before {
          content: " ";
          display: block;
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.3) 50%);
          background-size: 100% 4px;
          z-index: 10001;
          pointer-events: none;
          opacity: 0.8;
        }

        .auth-card {
          background: #0d1222;
          border: 3px solid #00d2ff;
          border-radius: 12px;
          padding: 32px 40px;
          max-width: 460px;
          width: 90%;
          box-shadow: 0 0 35px rgba(0, 210, 255, 0.4), inset 0 0 20px rgba(0, 210, 255, 0.08);
          position: relative;
          z-index: 10002;
          text-align: center;
        }

        .auth-title {
          font-size: 26px;
          font-weight: 900;
          color: #f1c40f;
          letter-spacing: 3px;
          margin-bottom: 6px;
          text-shadow: 0 0 12px rgba(241, 196, 15, 0.8);
        }

        .auth-sub {
          font-size: 12px;
          color: #00ffff;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 24px;
        }

        .auth-desc {
          font-size: 13px;
          color: #bdc3c7;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .auth-input-box {
          position: relative;
          margin-bottom: 18px;
        }

        .auth-input {
          width: 100%;
          background: #060914;
          border: 2px solid #293a5e;
          border-radius: 6px;
          padding: 14px 16px;
          font-family: inherit;
          font-size: 18px;
          font-weight: bold;
          color: #00ffff;
          letter-spacing: 4px;
          text-align: center;
          outline: none;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.8);
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .auth-input:focus {
          border-color: #00d2ff;
          box-shadow: 0 0 14px rgba(0, 210, 255, 0.6);
        }

        .auth-btn {
          width: 100%;
          background: linear-gradient(180deg, #2ecc71, #27ae60);
          color: #fff;
          border: none;
          padding: 14px;
          font-family: inherit;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 2px;
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(46, 204, 113, 0.5);
          transition: all 0.15s ease;
        }

        .auth-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(46, 204, 113, 0.7);
        }

        .auth-error {
          color: #e74c3c;
          font-size: 12px;
          font-weight: bold;
          margin-top: 12px;
          display: none;
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
          75% { transform: translateX(-4px); }
        }
      </style>

      <div class="auth-card">
        <div class="auth-title">🔐 TOP GEAR: LEGADO</div>
        <div class="auth-sub">ACESSO PRIVADO • VERCEL GATE</div>

        <div class="auth-desc">
          Este jogo está protegido contra acessos não autorizados.<br/>
          Digite a senha de piloto para liberar o acesso:
        </div>

        <div class="auth-input-box">
          <input
            type="password"
            id="auth-pass-input"
            class="auth-input"
            placeholder="SENHA..."
            autocomplete="current-password"
            autofocus
          />
        </div>

        <button id="btn-auth-unlock" class="auth-btn">
          🔓 DESBLOQUEAR JOGO
        </button>

        <div id="auth-error-msg" class="auth-error">
          ❌ SENHA INCORRETA! TENTE NOVAMENTE.
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const input = this.overlay.querySelector<HTMLInputElement>('#auth-pass-input');
    const btn = this.overlay.querySelector<HTMLButtonElement>('#btn-auth-unlock');
    const errorEl = this.overlay.querySelector<HTMLDivElement>('#auth-error-msg');

    const tryUnlock = () => {
      if (!input) return;
      const pass = input.value.trim().toLowerCase();

      // Verifica senhas válidas
      if (this.defaultPasswords.includes(pass)) {
        localStorage.setItem('topgear_auth_unlocked', 'true');
        soundSystem.init();
        soundSystem.playBeep(880);
        this.destroy();
        this.onUnlockCallback();
      } else {
        soundSystem.init();
        soundSystem.playBeep(220);
        if (errorEl) {
          errorEl.style.display = 'block';
        }
        input.value = '';
        input.focus();
      }
    };

    if (btn) btn.onclick = tryUnlock;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          tryUnlock();
        }
      };
    }
  }

  public destroy(): void {
    this.overlay.remove();
  }
}
