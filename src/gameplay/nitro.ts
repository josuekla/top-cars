export interface NitroState {
  charges: number;
  maxCharges: number;
  isActive: boolean;
  timer: number;
  duration: number;
}

export class NitroSystem {
  public charges: number;
  public readonly maxCharges: number;
  public readonly duration: number;
  public timer: number = 0;

  constructor(maxCharges: number = 3, duration: number = 2.5) {
    this.maxCharges = maxCharges;
    this.charges = maxCharges;
    this.duration = duration;
  }

  public get isActive(): boolean {
    return this.timer > 0;
  }

  public trigger(): boolean {
    if (this.isActive || this.charges <= 0) {
      return false;
    }

    this.charges -= 1;
    this.timer = this.duration;
    return true;
  }

  public update(dt: number): void {
    if (this.timer > 0) {
      this.timer = Math.max(0, this.timer - dt);
    }
  }

  public rechargeOnNewLap(chargesPerLap: number = 1): void {
    this.charges = Math.min(this.maxCharges, this.charges + chargesPerLap);
  }

  public reset(): void {
    this.charges = this.maxCharges;
    this.timer = 0;
  }

  public getState(): NitroState {
    return {
      charges: this.charges,
      maxCharges: this.maxCharges,
      isActive: this.isActive,
      timer: this.timer,
      duration: this.duration,
    };
  }
}
