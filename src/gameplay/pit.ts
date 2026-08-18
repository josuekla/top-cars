import type { FuelSystem } from './fuel';

export interface PitState {
  isInPit: boolean;
  isRefueling: boolean;
  refuelProgress: number;
}

export class PitManager {
  public isInPit: boolean = false;
  public isRefueling: boolean = false;

  public update(isOnPitLane: boolean, fuelSystem: FuelSystem, dt: number): PitState {
    this.isInPit = isOnPitLane;

    if (isOnPitLane) {
      if (fuelSystem.current < fuelSystem.max) {
        this.isRefueling = true;
        fuelSystem.refuel(dt);
      } else {
        this.isRefueling = false;
      }
    } else {
      this.isRefueling = false;
    }

    return {
      isInPit: this.isInPit,
      isRefueling: this.isRefueling,
      refuelProgress: fuelSystem.percentage,
    };
  }
}
