import type { VehicleInput } from '../core';

export class InputManager {
  private keys: Record<string, boolean> = {};
  private onKeyDownCallback?: (code: string) => void;
  private currentSteer: number = 0;
  private lastTime: number = performance.now();

  constructor(onKeyDown?: (code: string) => void) {
    this.onKeyDownCallback = onKeyDown;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (this.onKeyDownCallback) {
      this.onKeyDownCallback(e.code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  public getInput(): VehicleInput {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    let throttle = this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0;
    let brake = this.keys['KeyS'] || this.keys['ArrowDown'] || this.keys['Space'] ? 1 : 0;

    let targetSteer = 0;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      targetSteer -= 1;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      targetSteer += 1;
    }

    // Suavização do esterço de teclado (ataque ágil de ~10/s e centralização rápida de ~16/s)
    const steerRate = targetSteer === 0 ? 16 : 10;
    this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1, dt * steerRate);
    if (Math.abs(this.currentSteer) < 0.005 && targetSteer === 0) {
      this.currentSteer = 0;
    }

    let steer = this.currentSteer;
    let nitro = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyN']);

    // Suporte Gamepad (Controles Xbox / PlayStation / USB)
    if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];
      if (gp) {
        // Stick analógico esquerdo
        const axisX = gp.axes[0];
        if (Math.abs(axisX) > 0.12) {
          steer = axisX;
          this.currentSteer = axisX;
        }

        // Gatilhos e botões
        const rt = gp.buttons[7]?.value ?? (gp.buttons[0]?.pressed ? 1 : 0);
        const lt = gp.buttons[6]?.value ?? (gp.buttons[1]?.pressed ? 1 : 0);
        const nitroBtn = gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || gp.buttons[5]?.pressed;

        if (rt > 0.1) throttle = Math.max(throttle, rt);
        if (lt > 0.1) brake = Math.max(brake, lt);
        if (nitroBtn) nitro = true;
      }
    }

    return {
      throttle,
      brake,
      steer: Math.max(-1, Math.min(1, steer)),
      nitro,
    };
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
