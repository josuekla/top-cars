export type CarId = 'cannibal' | 'sidewinder' | 'razor' | 'weasel' | 'night_viper';

export type SurfaceType = 'asphalt' | 'grass' | 'gravel' | 'pit';

export interface CarStats {
  id: CarId;
  name: string;
  color: string;
  topSpeed: number;
  acceleration: number;
  braking: number;
  handling: number;
  fuelTank: number;
  fuelConsumption: number;
  nitroBoostMultiplier: number;
  nitroTopSpeedBonus: number;
  nitroDuration: number;
}

export interface VehicleInput {
  throttle: number;
  brake: number;
  steer: number;
  nitro: boolean;
}

export interface VehicleState {
  x: number;
  y: number;
  angle: number;
  speed: number;
  lateralVelocity: number;
  fuel: number;
  nitroTimer: number;
  isOutOfFuel: boolean;
  surface: SurfaceType;
}

export interface SurfaceProperties {
  friction: number;
  maxSpeedMultiplier: number;
  rollingResistance: number;
  grip: number;
}

export interface PhysicsConfig {
  fixedDeltaTime: number;
  naturalFriction: number;
  reverseMaxSpeed: number;
  reverseAccel: number;
  minSpeedForTurn: number;
  speedSteerFalloff: number;
  lateralFriction: number;
  driftFactor: number;
  crawlSpeed: number;
  crawlAccel: number;
}
