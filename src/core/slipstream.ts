import type { VehicleState } from './types';

export interface SlipstreamResult {
  inSlipstream: boolean;
  boostFactor: number; // Multiplicador de aceleração/velocidade (ex: 1.15)
  distance: number;
}

export const SLIPSTREAM_MAX_DISTANCE = 26.0; // metros
export const SLIPSTREAM_MIN_DISTANCE = 3.5;
export const SLIPSTREAM_MAX_ANGLE_DEG = 18.0;

/**
 * Calcula se o carro seguidor está no cone de vácuo do carro líder
 */
export function calculateSlipstream(leadCar: VehicleState, followCar: VehicleState): SlipstreamResult {
  const dx = leadCar.x - followCar.x;
  const dy = leadCar.y - followCar.y;
  const dist = Math.hypot(dx, dy);

  if (dist < SLIPSTREAM_MIN_DISTANCE || dist > SLIPSTREAM_MAX_DISTANCE) {
    return { inSlipstream: false, boostFactor: 1.0, distance: dist };
  }

  // Ângulo do vetor do carro seguidor até o carro líder
  const angleToLead = Math.atan2(dy, dx);

  // O vetor deve estar alinhado com a direção do carro seguidor
  const angleDiff = Math.abs(normalizeAngle(angleToLead - followCar.angle));
  const maxAngleRad = (SLIPSTREAM_MAX_ANGLE_DEG * Math.PI) / 180;

  if (angleDiff > maxAngleRad) {
    return { inSlipstream: false, boostFactor: 1.0, distance: dist };
  }

  // Bônus proporcional à proximidade (mais perto = mais vácuo)
  const proximityRatio = 1 - (dist - SLIPSTREAM_MIN_DISTANCE) / (SLIPSTREAM_MAX_DISTANCE - SLIPSTREAM_MIN_DISTANCE);
  const boostFactor = 1.0 + proximityRatio * 0.20; // Até +20% de aceleração/top speed no vácuo

  return {
    inSlipstream: true,
    boostFactor,
    distance: dist,
  };
}

function normalizeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
