import type { Racer } from '../race/race';

export class ResultsScreen {
  private container: HTMLElement;
  private overlay: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.overlay = document.createElement('div');
    this.overlay.id = 'results-screen';
    this.overlay.style.display = 'none';
    this.setupLayout();
    this.container.appendChild(this.overlay);
  }

  private setupLayout(): void {
    this.overlay.innerHTML = `
      <style>
        #results-screen {
          position: absolute;
          inset: 0;
          background: rgba(10, 15, 30, 0.92);
          backdrop-filter: blur(8px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'Courier New', monospace, sans-serif;
          color: #fff;
          z-index: 1000;
          user-select: none;
        }
        .results-box {
          background: #151b2e;
          border: 3px solid #f1c40f;
          border-radius: 12px;
          padding: 28px 36px;
          width: 90%;
          max-width: 620px;
          box-shadow: 0 0 30px rgba(241, 196, 15, 0.4);
          text-align: center;
        }
        .results-title {
          font-size: 32px;
          font-weight: 900;
          color: #f1c40f;
          text-shadow: 0 0 12px rgba(241, 196, 15, 0.8);
          margin-bottom: 6px;
          letter-spacing: 2px;
        }
        .results-subtitle {
          font-size: 14px;
          color: #bdc3c7;
          margin-bottom: 20px;
        }
        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .results-table th {
          border-bottom: 2px solid #3a4b7c;
          padding: 8px 10px;
          color: #8899bb;
          font-size: 12px;
          text-transform: uppercase;
        }
        .results-table td {
          padding: 10px;
          border-bottom: 1px solid #222d48;
          font-size: 14px;
          font-weight: bold;
        }
        .results-table tr.player-row {
          background: rgba(46, 204, 113, 0.2);
          color: #2ecc71;
        }
        .results-table tr.winner-row td:first-child {
          color: #f1c40f;
        }
        .results-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
        }
        .btn-retro {
          background: #e74c3c;
          color: #fff;
          border: none;
          padding: 12px 24px;
          font-family: inherit;
          font-size: 14px;
          font-weight: bold;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 10px rgba(231, 76, 60, 0.4);
        }
        .btn-retro:hover {
          background: #c0392b;
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(231, 76, 60, 0.6);
        }
        .btn-retro.btn-secondary {
          background: #34495e;
          box-shadow: 0 4px 10px rgba(52, 73, 94, 0.4);
        }
        .btn-retro.btn-secondary:hover {
          background: #2c3e50;
        }
      </style>

      <div class="results-box">
        <div id="results-title" class="results-title">FIM DE CORRIDA!</div>
        <div id="results-subtitle" class="results-subtitle">CLASSIFICAÇÃO FINAL</div>

        <table class="results-table">
          <thead>
            <tr>
              <th>POS</th>
              <th>PILOTO</th>
              <th>CARRO</th>
              <th>TEMPO TOTAL</th>
              <th>MELHOR VOLTA</th>
            </tr>
          </thead>
          <tbody id="results-tbody"></tbody>
        </table>

        <div class="results-buttons">
          <button id="btn-restart" class="btn-retro">JOGAR NOVAMENTE (ESPAÇO)</button>
          <button id="btn-menu" class="btn-retro btn-secondary">MENU PRINCIPAL (ESC)</button>
        </div>
      </div>
    `;
  }

  private formatTime(seconds: number | null): string {
    if (seconds === null) return '--:--.--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  public show(
    leaderboard: Racer[],
    onRestart: () => void,
    onMenu: () => void
  ): void {
    const player = leaderboard.find((r) => r.isPlayer);
    const playerRank = player?.finishRank ?? player?.currentRank ?? 1;

    const titleEl = this.overlay.querySelector<HTMLDivElement>('#results-title');
    const subtitleEl = this.overlay.querySelector<HTMLDivElement>('#results-subtitle');
    const tbody = this.overlay.querySelector<HTMLTableSectionElement>('#results-tbody');

    if (titleEl) {
      if (playerRank === 1) {
        titleEl.textContent = '🏆 VITÓRIA! 🏆';
        titleEl.style.color = '#f1c40f';
      } else if (playerRank <= 3) {
        titleEl.textContent = `PÓDIO! ${playerRank}º LUGAR`;
        titleEl.style.color = '#e67e22';
      } else {
        titleEl.textContent = `${playerRank}º LUGAR`;
        titleEl.style.color = '#e74c3c';
      }
    }

    if (subtitleEl) {
      subtitleEl.textContent = `Autódromo do Legado — ${leaderboard.length} Pilotos`;
    }

    if (tbody) {
      tbody.innerHTML = '';
      leaderboard.forEach((racer, index) => {
        const tr = document.createElement('tr');
        const pos = racer.finishRank ?? index + 1;
        if (racer.isPlayer) tr.classList.add('player-row');
        if (pos === 1) tr.classList.add('winner-row');

        tr.innerHTML = `
          <td>${pos}º</td>
          <td>${racer.name}</td>
          <td style="color: ${racer.stats.color};">${racer.stats.name}</td>
          <td>${this.formatTime(racer.finishTime)}</td>
          <td>${this.formatTime(racer.lapTracker.bestLapTime)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const btnRestart = this.overlay.querySelector<HTMLButtonElement>('#btn-restart');
    const btnMenu = this.overlay.querySelector<HTMLButtonElement>('#btn-menu');

    if (btnRestart) btnRestart.onclick = () => onRestart();
    if (btnMenu) btnMenu.onclick = () => onMenu();

    this.overlay.style.display = 'flex';
  }

  public hide(): void {
    this.overlay.style.display = 'none';
  }

  public destroy(): void {
    this.overlay.remove();
  }
}
