import type { VehicleState } from '../core';
import type { NetworkPlayerState } from './protocol';

/**
 * Calcula a interpolação linear entre dois valores escalares
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Interpolação angular suave pelo caminho mais curto (-PI a +PI)
 * Evita rotações espúrias de 360 graus quando cruza o eixo -PI/PI
 */
export function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * Math.max(0, Math.min(1, t));
}

export interface StateSnapshot {
  state: VehicleState;
  lap: number;
  progress: number;
  nitroActive: boolean;
  steer: number;
  timestamp: number;
  receivedAt: number;
}

export interface InterpolatedPlayerState {
  state: VehicleState;
  lap: number;
  progress: number;
  nitroActive: boolean;
  steer: number;
  isExtrapolated: boolean;
}

export class NetworkStateInterpolator {
  private buffers: Map<string, StateSnapshot[]> = new Map();
  public interpolationDelayMs: number = 65; // Janela de buffer de 65ms para compensação de jitter
  public maxExtrapolationTimeMs: number = 1000; // Máximo de 1.0s de Dead Reckoning antes de frear o carro
  public maxBufferSize: number = 30;

  /**
   * Adiciona um snapshot de estado recebido pela rede
   */
  public pushSnapshot(playerId: string, playerState: NetworkPlayerState, localTime?: number): void {
    const now = localTime !== undefined ? localTime : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const timestamp = playerState.timestamp > 0 ? playerState.timestamp : now;

    let playerBuffer = this.buffers.get(playerId);
    if (!playerBuffer) {
      playerBuffer = [];
      this.buffers.set(playerId, playerBuffer);
    }

    const snapshot: StateSnapshot = {
      state: { ...playerState.state },
      lap: playerState.lap,
      progress: playerState.progress,
      nitroActive: playerState.nitroActive,
      steer: playerState.steer,
      timestamp,
      receivedAt: now,
    };

    // Insere mantendo a ordenação temporal
    const insertIdx = playerBuffer.findIndex((s) => s.timestamp > timestamp);
    if (insertIdx === -1) {
      playerBuffer.push(snapshot);
    } else {
      playerBuffer.splice(insertIdx, 0, snapshot);
    }

    // Limita o tamanho do buffer para evitar consumo excessivo de memória
    if (playerBuffer.length > this.maxBufferSize) {
      playerBuffer.splice(0, playerBuffer.length - this.maxBufferSize);
    }
  }

  /**
   * Calcula o estado interpolado ou predito (Dead Reckoning) no tempo de renderização atual
   */
  public getInterpolatedState(playerId: string, currentRenderTime?: number): InterpolatedPlayerState | null {
    const buffer = this.buffers.get(playerId);
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // Caso tenhamos apenas 1 snapshot no buffer
    if (buffer.length === 1) {
      const snap = buffer[0];
      return {
        state: { ...snap.state },
        lap: snap.lap,
        progress: snap.progress,
        nitroActive: snap.nitroActive,
        steer: snap.steer,
        isExtrapolated: false,
      };
    }

    const now = currentRenderTime !== undefined ? currentRenderTime : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const targetTime = now - this.interpolationDelayMs;

    const oldest = buffer[0];
    const latest = buffer[buffer.length - 1];

    // 1. Caso o tempo alvo seja anterior ao snapshot mais antigo disponível
    if (targetTime <= oldest.timestamp) {
      return {
        state: { ...oldest.state },
        lap: oldest.lap,
        progress: oldest.progress,
        nitroActive: oldest.nitroActive,
        steer: oldest.steer,
        isExtrapolated: false,
      };
    }

    // 2. Caso o tempo alvo seja posterior ao snapshot mais recente (LAG / PACKET DROP) -> DEAD RECKONING
    if (targetTime > latest.timestamp) {
      const deltaSec = Math.min((targetTime - latest.timestamp) / 1000, this.maxExtrapolationTimeMs / 1000);
      const damping = Math.max(0, 1 - (deltaSec / (this.maxExtrapolationTimeMs / 1000)) * 0.6);

      // Velocidade vetorial cartesiana no plano da pista
      const vx = Math.cos(latest.state.angle) * latest.state.speed - Math.sin(latest.state.angle) * latest.state.lateralVelocity;
      const vy = Math.sin(latest.state.angle) * latest.state.speed + Math.cos(latest.state.angle) * latest.state.lateralVelocity;

      const extrapolatedX = latest.state.x + vx * deltaSec * damping;
      const extrapolatedY = latest.state.y + vy * deltaSec * damping;
      const extrapolatedAngle = latest.state.angle + latest.steer * 2.8 * deltaSec * damping;
      const extrapolatedSpeed = latest.state.speed * damping;

      const extrapolatedState: VehicleState = {
        ...latest.state,
        x: extrapolatedX,
        y: extrapolatedY,
        angle: extrapolatedAngle,
        speed: extrapolatedSpeed,
        lateralVelocity: latest.state.lateralVelocity * damping,
      };

      return {
        state: extrapolatedState,
        lap: latest.lap,
        progress: latest.progress,
        nitroActive: latest.nitroActive,
        steer: latest.steer,
        isExtrapolated: true,
      };
    }

    // 3. Caso normal: interpolação suave entre dois snapshots (LERP + shortest angle)
    for (let i = 0; i < buffer.length - 1; i++) {
      const s0 = buffer[i];
      const s1 = buffer[i + 1];

      if (targetTime >= s0.timestamp && targetTime <= s1.timestamp) {
        const timeDiff = s1.timestamp - s0.timestamp;
        const factor = timeDiff > 0.0001 ? (targetTime - s0.timestamp) / timeDiff : 0;

        const interpolatedState: VehicleState = {
          ...s1.state,
          x: lerp(s0.state.x, s1.state.x, factor),
          y: lerp(s0.state.y, s1.state.y, factor),
          angle: lerpAngle(s0.state.angle, s1.state.angle, factor),
          speed: lerp(s0.state.speed, s1.state.speed, factor),
          lateralVelocity: lerp(s0.state.lateralVelocity, s1.state.lateralVelocity, factor),
          fuel: lerp(s0.state.fuel, s1.state.fuel, factor),
          nitroTimer: lerp(s0.state.nitroTimer, s1.state.nitroTimer, factor),
          surface: factor > 0.5 ? s1.state.surface : s0.state.surface,
          isOutOfFuel: factor > 0.5 ? s1.state.isOutOfFuel : s0.state.isOutOfFuel,
        };

        return {
          state: interpolatedState,
          lap: factor > 0.5 ? s1.lap : s0.lap,
          progress: lerp(s0.progress, s1.progress, factor),
          nitroActive: s0.nitroActive || s1.nitroActive,
          steer: lerp(s0.steer, s1.steer, factor),
          isExtrapolated: false,
        };
      }
    }

    return {
      state: { ...latest.state },
      lap: latest.lap,
      progress: latest.progress,
      nitroActive: latest.nitroActive,
      steer: latest.steer,
      isExtrapolated: false,
    };
  }

  public getBufferSize(playerId: string): number {
    return this.buffers.get(playerId)?.length || 0;
  }

  public removePlayer(playerId: string): void {
    this.buffers.delete(playerId);
  }

  public clear(): void {
    this.buffers.clear();
  }
}
