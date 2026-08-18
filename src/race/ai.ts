import type { CarStats, VehicleInput, VehicleState } from '../core';
import { normalizeAngle } from '../core';
import type { Track } from '../track';
import { sampleTrackAtDistance } from '../track';

export type AIDifficulty = 'amateur' | 'pro' | 'championship';

export interface AIDifficultyConfig {
  speedFactor: number;
  steerResponsiveness: number;
  lookAheadDist: number;
  rubberBandMaxBoost: number;
  rubberBandMaxSlowdown: number;
}

export const AI_DIFFICULTY_CONFIGS: Record<AIDifficulty, AIDifficultyConfig> = {
  amateur: {
    speedFactor: 0.80,
    steerResponsiveness: 2.0,
    lookAheadDist: 18,
    rubberBandMaxBoost: 0.08,
    rubberBandMaxSlowdown: 0.12,
  },
  pro: {
    speedFactor: 0.92,
    steerResponsiveness: 2.6,
    lookAheadDist: 22,
    rubberBandMaxBoost: 0.12,
    rubberBandMaxSlowdown: 0.08,
  },
  championship: {
    speedFactor: 1.00,
    steerResponsiveness: 3.2,
    lookAheadDist: 26,
    rubberBandMaxBoost: 0.15,
    rubberBandMaxSlowdown: 0.05,
  },
};

export class AICarController {
  public laneOffset: number; // Deslocamento lateral da linha ideal (-3m a +3m)
  private nitroCooldown: number = 5.0;

  constructor(laneOffset: number = 0) {
    this.laneOffset = laneOffset;
  }

  public computeInput(
    state: VehicleState,
    stats: CarStats,
    track: Track,
    currentTrackDist: number,
    playerDist: number,
    difficulty: AIDifficulty = 'pro',
    dt: number = 1 / 60
  ): VehicleInput {
    const config = AI_DIFFICULTY_CONFIGS[difficulty];

    // 1. Amostra o ponto alvo da pista à frente
    const targetDistance = (currentTrackDist + config.lookAheadDist) % track.totalLength;
    const targetPoint = sampleTrackAtDistance(track, targetDistance);

    // Ajusta o ponto com o desvio de faixa lateral da IA
    const targetX = targetPoint.x + targetPoint.normalX * this.laneOffset;
    const targetY = targetPoint.y + targetPoint.normalY * this.laneOffset;

    // Ângulo desejado em direção ao ponto alvo
    const dx = targetX - state.x;
    const dy = targetY - state.y;
    const desiredAngle = Math.atan2(dy, dx);

    // Diferença angular
    const angleDiff = normalizeAngle(desiredAngle - state.angle);

    // 2. Controle de Esterço (angleDiff > 0 -> precisa virar para a direita [steer > 0])
    const steer = Math.max(-1, Math.min(1, angleDiff * config.steerResponsiveness));

    // 3. Rubber-banding leve (mantém o jogo disputado sem trapaças exageradas)
    let distDiff = playerDist - currentTrackDist;
    // Corrige wrap em loop fechado
    if (distDiff > track.totalLength / 2) distDiff -= track.totalLength;
    if (distDiff < -track.totalLength / 2) distDiff += track.totalLength;

    let rubberBandFactor = 0;
    if (distDiff > 30) {
      // Jogador está muito à frente -> IA ganha leve aceleração
      rubberBandFactor = Math.min(config.rubberBandMaxBoost, (distDiff / 100) * config.rubberBandMaxBoost);
    } else if (distDiff < -30) {
      // Jogador está muito atrás -> IA alivia levemente
      rubberBandFactor = Math.max(-config.rubberBandMaxSlowdown, (distDiff / 100) * config.rubberBandMaxSlowdown);
    }

    const targetMaxSpeed = stats.topSpeed * (config.speedFactor + rubberBandFactor);

    // 4. Aceleração e Frenagem em Curvas
    let throttle = 1.0;
    let brake = 0.0;

    const turnSeverity = Math.abs(angleDiff);
    if (turnSeverity > 0.45 && state.speed > targetMaxSpeed * 0.6) {
      // Curva fechada: reduz aceleração ou freia suavemente
      throttle = 0.3;
      if (turnSeverity > 0.75 && state.speed > targetMaxSpeed * 0.75) {
        brake = 0.6;
      }
    } else if (state.speed > targetMaxSpeed) {
      throttle = 0.0;
    }

    // 5. Uso estratégico de Nitro pela IA
    this.nitroCooldown = Math.max(0, this.nitroCooldown - dt);
    let useNitro = false;

    // Usa nitro em retas se estiver em velocidade alta
    if (
      this.nitroCooldown <= 0 &&
      turnSeverity < 0.15 &&
      state.speed > stats.topSpeed * 0.75 &&
      Math.random() < 0.02
    ) {
      useNitro = true;
      this.nitroCooldown = 15.0; // Intervalo entre usos
    }

    return {
      throttle,
      brake,
      steer,
      nitro: useNitro,
    };
  }
}
