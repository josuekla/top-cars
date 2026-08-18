import type { Track } from '../track';
import type { Racer } from '../race';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private track: Track;

  private minX: number = 0;
  private maxX: number = 0;
  private minY: number = 0;
  private maxY: number = 0;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;

  constructor(parent: HTMLElement, track: Track, width: number = 160, height: number = 120) {
    this.track = track;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'hud-minimap-canvas';
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.cssText = `
      background: rgba(12, 17, 30, 0.85);
      border: 2px solid #293a5e;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    `;

    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível obter contexto 2D para o minimapa');
    this.ctx = context;

    this.computeBounds(width, height);
    parent.appendChild(this.canvas);
  }

  private computeBounds(width: number, height: number): void {
    const points = this.track.points;
    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minY = Infinity;
    this.maxY = -Infinity;

    for (const pt of points) {
      if (pt.x < this.minX) this.minX = pt.x;
      if (pt.x > this.maxX) this.maxX = pt.x;
      if (pt.y < this.minY) this.minY = pt.y;
      if (pt.y > this.maxY) this.maxY = pt.y;
    }

    const padding = 16;
    const trackW = Math.max(1, this.maxX - this.minX);
    const trackH = Math.max(1, this.maxY - this.minY);

    const scaleX = (width - padding * 2) / trackW;
    const scaleY = (height - padding * 2) / trackH;
    this.scale = Math.min(scaleX, scaleY);

    this.offsetX = padding + (width - padding * 2 - trackW * this.scale) / 2 - this.minX * this.scale;
    this.offsetY = padding + (height - padding * 2 - trackH * this.scale) / 2 - this.minY * this.scale;
  }

  public update(racers: Racer[]): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Desenha o Traçado da Pista
    const points = this.track.points;
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = '#1e2942';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * this.scale + this.offsetX;
      const py = points[i].y * this.scale + this.offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Linha interna da pista (Brilho ciano sutil)
    ctx.beginPath();
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < points.length; i++) {
      const px = points[i].x * this.scale + this.offsetX;
      const py = points[i].y * this.scale + this.offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Linha de largada (Ponto amarelo)
    const startX = points[0].x * this.scale + this.offsetX;
    const startY = points[0].y * this.scale + this.offsetY;
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(startX - 2, startY - 2, 4, 4);

    // 2. Desenha a Posição dos Corredores
    for (const racer of racers) {
      const rx = racer.state.x * this.scale + this.offsetX;
      const ry = racer.state.y * this.scale + this.offsetY;

      ctx.beginPath();
      if (racer.isPlayer) {
        // Jogador em destaque (Ponto piscante com halo)
        const pulse = 4 + Math.sin(performance.now() * 0.01) * 1.5;
        ctx.arc(rx, ry, pulse, 0, Math.PI * 2);
        ctx.fillStyle = '#f1c40f';
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // IA
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fillStyle = racer.stats.color;
        ctx.fill();
      }
    }
  }

  public destroy(): void {
    this.canvas.remove();
  }
}
