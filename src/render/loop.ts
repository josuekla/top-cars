export type PhysicsUpdateCallback = (fixedDt: number) => void;
export type RenderUpdateCallback = (frameDt: number) => void;

export class GameLoop {
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number;
  private readonly maxFrameTime: number;
  private animationFrameId: number | null = null;

  private onPhysics: PhysicsUpdateCallback;
  private onRender: RenderUpdateCallback;

  constructor(
    onPhysics: PhysicsUpdateCallback,
    onRender: RenderUpdateCallback,
    fixedHz: number = 60,
    maxFrameTime: number = 0.1
  ) {
    this.onPhysics = onPhysics;
    this.onRender = onRender;
    this.fixedDt = 1 / fixedHz;
    this.maxFrameTime = maxFrameTime;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick = (currentTime: number): void => {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Limita frame time para evitar "spiral of death"
    if (delta > this.maxFrameTime) {
      delta = this.maxFrameTime;
    }

    this.accumulator += delta;

    // Atualização de física com passo fixo (60 Hz)
    while (this.accumulator >= this.fixedDt) {
      this.onPhysics(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Renderização com o delta do frame atual
    this.onRender(delta);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}
