import type { VehicleState } from './types';

export interface CollisionResult {
  hasCollided: boolean;
  impulse: number;
}

export const VEHICLE_COLLISION_RADIUS = 1.8; // Raio de colisão esférico em metros

/**
 * Resolve a colisão entre dois veículos com resposta elástica/impulso arcade
 */
export function resolveVehicleCollision(
  stateA: VehicleState,
  stateB: VehicleState,
  restitution: number = 0.65
): CollisionResult {
  const dx = stateA.x - stateB.x;
  const dy = stateA.y - stateB.y;
  const distSq = dx * dx + dy * dy;
  const minDist = VEHICLE_COLLISION_RADIUS * 2;

  if (distSq >= minDist * minDist || distSq < 0.0001) {
    return { hasCollided: false, impulse: 0 };
  }

  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = minDist - dist;

  // Separação posicional (50% para cada carro)
  const separation = overlap * 0.5;
  stateA.x += nx * separation;
  stateA.y += ny * separation;
  stateB.x -= nx * separation;
  stateB.y -= ny * separation;

  // Vetores de velocidade dos carros
  const vxA = Math.cos(stateA.angle) * stateA.speed - Math.sin(stateA.angle) * stateA.lateralVelocity;
  const vyA = Math.sin(stateA.angle) * stateA.speed + Math.cos(stateA.angle) * stateA.lateralVelocity;

  const vxB = Math.cos(stateB.angle) * stateB.speed - Math.sin(stateB.angle) * stateB.lateralVelocity;
  const vyB = Math.sin(stateB.angle) * stateB.speed + Math.cos(stateB.angle) * stateB.lateralVelocity;

  const relVx = vxA - vxB;
  const relVy = vyA - vyB;
  const relVelAlongNormal = relVx * nx + relVy * ny;

  // Se já estão se afastando, não aplica impulso extra
  if (relVelAlongNormal > 0) {
    return { hasCollided: true, impulse: 0 };
  }

  // Cálculo do impulso
  const impulseMag = -(1 + restitution) * relVelAlongNormal * 0.5;

  const impX = nx * impulseMag;
  const impY = ny * impulseMag;

  // Projeta o impulso na direção do carro A
  const fwdAx = Math.cos(stateA.angle);
  const fwdAy = Math.sin(stateA.angle);
  const latAx = -Math.sin(stateA.angle);
  const latAy = Math.cos(stateA.angle);

  stateA.speed += (impX * fwdAx + impY * fwdAy);
  stateA.lateralVelocity += (impX * latAx + impY * latAy);

  // Projeta o impulso oposto na direção do carro B
  const fwdBx = Math.cos(stateB.angle);
  const fwdBy = Math.sin(stateB.angle);
  const latBx = -Math.sin(stateB.angle);
  const latBy = Math.cos(stateB.angle);

  stateB.speed -= (impX * fwdBx + impY * fwdBy);
  stateB.lateralVelocity -= (impX * latBx + impY * latBy);

  return { hasCollided: true, impulse: Math.abs(impulseMag) };
}
