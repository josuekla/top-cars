import type { CarStats, PhysicsConfig, SurfaceType, VehicleInput, VehicleState } from './types';
import { getSurfaceProperties } from './surface';
import { getCarStats } from './cars';

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  fixedDeltaTime: 1 / 60,
  naturalFriction: 6.0,
  reverseMaxSpeed: 18.0,
  reverseAccel: 14.0,
  minSpeedForTurn: 2.0,
  speedSteerFalloff: 0.35,
  lateralFriction: 14.0,
  driftFactor: 0.10,
  crawlSpeed: 12.0,
  crawlAccel: 4.0,
};

export function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) {
    a -= Math.PI * 2;
  } else if (a < -Math.PI) {
    a += Math.PI * 2;
  }
  return a;
}

export function createDefaultVehicleState(
  stats?: CarStats,
  initialPos: { x?: number; y?: number; angle?: number; fuel?: number } = {}
): VehicleState {
  const resolvedStats = stats ?? getCarStats();
  return {
    x: initialPos.x ?? 0,
    y: initialPos.y ?? 0,
    angle: initialPos.angle ?? 0,
    speed: 0,
    lateralVelocity: 0,
    fuel: initialPos.fuel ?? resolvedStats.fuelTank,
    nitroTimer: 0,
    isOutOfFuel: false,
    surface: 'asphalt',
  };
}

export function calculateEffectiveTopSpeed(
  stats: CarStats,
  surface: SurfaceType,
  isNitroActive: boolean,
  isOutOfFuel: boolean,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG
): number {
  if (isOutOfFuel) {
    return config.crawlSpeed;
  }

  const surfaceProps = getSurfaceProperties(surface);
  let topSpeed = stats.topSpeed * surfaceProps.maxSpeedMultiplier;

  if (isNitroActive) {
    topSpeed += stats.nitroTopSpeedBonus;
  }

  return topSpeed;
}

export function calculateEffectiveAcceleration(
  stats: CarStats,
  isNitroActive: boolean,
  isOutOfFuel: boolean,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG
): number {
  if (isOutOfFuel) {
    return config.crawlAccel;
  }

  let accel = stats.acceleration;
  if (isNitroActive) {
    accel *= stats.nitroBoostMultiplier;
  }

  return accel;
}

export function stepPhysics(
  state: VehicleState,
  input: VehicleInput,
  stats: CarStats,
  surface: SurfaceType = state.surface,
  dt: number = DEFAULT_PHYSICS_CONFIG.fixedDeltaTime,
  userConfig?: Partial<PhysicsConfig>
): VehicleState {
  const config: PhysicsConfig = { ...DEFAULT_PHYSICS_CONFIG, ...userConfig };
  const surfaceProps = getSurfaceProperties(surface);

  let nitroTimer = state.nitroTimer;
  if (input.nitro && nitroTimer <= 0 && state.fuel > 0) {
    nitroTimer = stats.nitroDuration;
  } else if (nitroTimer > 0) {
    nitroTimer = Math.max(0, nitroTimer - dt);
  }

  const isNitroActive = nitroTimer > 0;

  let fuel = state.fuel;
  if (fuel > 0) {
    const throttleUsage = Math.max(0, Math.min(1, input.throttle));
    const nitroMultiplier = isNitroActive ? 1.4 : 1.0;
    const consumption = stats.fuelConsumption * throttleUsage * nitroMultiplier * dt;
    fuel = Math.max(0, fuel - consumption);
  }
  const isOutOfFuel = fuel <= 0;

  const maxTopSpeed = calculateEffectiveTopSpeed(stats, surface, isNitroActive, isOutOfFuel, config);
  const effectiveAccel = calculateEffectiveAcceleration(stats, isNitroActive, isOutOfFuel, config);

  let speed = state.speed;

  if (input.throttle > 0) {
    const throttle = Math.min(1, Math.max(0, input.throttle));
    if (speed < maxTopSpeed) {
      speed += effectiveAccel * throttle * dt;
      if (speed > maxTopSpeed) {
        speed = maxTopSpeed;
      }
    } else {
      const extraDecel = surfaceProps.rollingResistance * 2.0;
      speed = Math.max(maxTopSpeed, speed - extraDecel * dt);
    }
  }

  if (input.brake > 0) {
    const brake = Math.min(1, Math.max(0, input.brake));
    if (speed > 0) {
      speed = Math.max(0, speed - stats.braking * brake * dt);
    } else {
      speed = Math.max(-config.reverseMaxSpeed, speed - config.reverseAccel * brake * dt);
    }
  }

  if (input.throttle === 0 && input.brake === 0) {
    const drag = (config.naturalFriction + surfaceProps.rollingResistance) * dt;
    if (speed > 0) {
      speed = Math.max(0, speed - drag);
    } else if (speed < 0) {
      speed = Math.min(0, speed + drag);
    }
  }

  if (speed > maxTopSpeed && surfaceProps.maxSpeedMultiplier < 1.0) {
    const offRoadDecel = surfaceProps.rollingResistance * 2.5 * dt;
    speed = Math.max(maxTopSpeed, speed - offRoadDecel);
  }

  let angle = state.angle;
  const absSpeed = Math.abs(speed);

  if (absSpeed > 0.05 && input.steer !== 0) {
    const steerInput = Math.min(1, Math.max(-1, input.steer));
    const speedRatio = Math.min(1, absSpeed / stats.topSpeed);
    const speedSensitivity = 1 - speedRatio * (1 - config.speedSteerFalloff);
    const lowSpeedFactor = Math.min(1, absSpeed / config.minSpeedForTurn);

    const steerRate = stats.handling * speedSensitivity * lowSpeedFactor * surfaceProps.grip;
    const directionSign = speed < 0 ? -1 : 1;
    // steerInput > 0 esterça para a direita (+Z no mundo 3D), steerInput < 0 esterça para a esquerda (-Z)
    const angleDelta = steerInput * steerRate * dt * directionSign;

    angle = normalizeAngle(angle + angleDelta);
  }

  const forwardX = Math.cos(angle);
  const forwardY = Math.sin(angle);
  const lateralX = -Math.sin(angle);
  const lateralY = Math.cos(angle);

  let lateralVelocity = state.lateralVelocity;
  if (input.steer !== 0 && absSpeed > 10) {
    const driftSlip = absSpeed * input.steer * config.driftFactor * dt;
    lateralVelocity += driftSlip;
  }
  const lateralDamping = Math.max(0, 1 - config.lateralFriction * surfaceProps.grip * dt);
  lateralVelocity *= lateralDamping;

  const vx = forwardX * speed + lateralX * lateralVelocity;
  const vy = forwardY * speed + lateralY * lateralVelocity;

  const x = state.x + vx * dt;
  const y = state.y + vy * dt;

  return {
    x,
    y,
    angle,
    speed,
    lateralVelocity,
    fuel,
    nitroTimer,
    isOutOfFuel,
    surface,
  };
}
