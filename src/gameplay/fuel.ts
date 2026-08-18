export interface FuelState {
  current: number;
  max: number;
  isLow: boolean;
  isEmpty: boolean;
  consumptionRate: number;
}

export class FuelSystem {
  public current: number;
  public readonly max: number;
  public readonly consumptionRate: number;
  public readonly refuelSpeed: number; // Unidades por segundo no pit

  constructor(max: number = 100, consumptionRate: number = 2.8, refuelSpeed: number = 35) {
    this.max = max;
    this.current = max;
    this.consumptionRate = consumptionRate;
    this.refuelSpeed = refuelSpeed;
  }

  public get isLow(): boolean {
    return this.current > 0 && this.current <= this.max * 0.2;
  }

  public get isEmpty(): boolean {
    return this.current <= 0;
  }

  public get percentage(): number {
    return (this.current / this.max) * 100;
  }

  public consume(throttle: number, isNitroActive: boolean, dt: number): number {
    if (this.isEmpty) return 0;

    const throttleFactor = Math.max(0, Math.min(1, throttle));
    const nitroFactor = isNitroActive ? 1.5 : 1.0;
    const amount = this.consumptionRate * throttleFactor * nitroFactor * dt;

    const actual = Math.min(this.current, amount);
    this.current = Math.max(0, this.current - actual);
    return actual;
  }

  public refuel(dt: number): number {
    if (this.current >= this.max) return 0;

    const amount = this.refuelSpeed * dt;
    const actual = Math.min(this.max - this.current, amount);
    this.current = Math.min(this.max, this.current + actual);
    return actual;
  }

  public reset(): void {
    this.current = this.max;
  }

  public getState(): FuelState {
    return {
      current: this.current,
      max: this.max,
      isLow: this.isLow,
      isEmpty: this.isEmpty,
      consumptionRate: this.consumptionRate,
    };
  }
}
