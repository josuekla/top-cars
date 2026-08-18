import {
  createDefaultVehicleState,
  getCarStats,
  stepPhysics,
  resolveVehicleCollision,
  calculateSlipstream,
  type CarId,
  type CarStats,
  type SurfaceType,
  type VehicleInput,
  type VehicleState,
} from '../core';
import type { Track } from '../track';
import { projectPositionOnTrack, sampleTrackAtDistance } from '../track';
import { createLapTracker, updateLapTracker, type LapTrackerState } from './lap';
import { AICarController, type AIDifficulty } from './ai';
import { FuelSystem } from '../gameplay/fuel';
import { NitroSystem } from '../gameplay/nitro';
import { PitManager } from '../gameplay/pit';

export type RaceMode = 'race' | 'timeattack' | 'multiplayer';
export type RaceStatus = 'countdown' | 'racing' | 'finished';

export interface MultiplayerPlayerConfig {
  id: string;
  name: string;
  carId: CarId;
  isLocal: boolean;
  slot: number;
}

export interface Racer {
  id: string;
  name: string;
  isPlayer: boolean;
  carId: CarId;
  stats: CarStats;
  state: VehicleState;
  lapTracker: LapTrackerState;
  fuelSystem: FuelSystem;
  nitroSystem: NitroSystem;
  pitManager: PitManager;
  aiController?: AICarController;
  finishTime: number | null;
  finishRank: number | null;
  currentRank: number;
}

export interface RaceConfig {
  mode: RaceMode;
  totalLaps: number;
  difficulty: AIDifficulty;
  playerCarId: CarId;
  aiCount: number;
  multiplayerPlayers?: MultiplayerPlayerConfig[];
}

export class RaceManager {
  public config: RaceConfig;
  public track: Track;
  public racers: Racer[] = [];
  public player!: Racer;
  public status: RaceStatus = 'countdown';
  public totalTime: number = 0;
  public lastCollisionImpulse: number = 0;
  public isPlayerInSlipstream: boolean = false;
  private countdownTimer: number = 3.99; // 3, 2, 1, GO!
  private finishCounter: number = 0;

  constructor(track: Track, config: Partial<RaceConfig> = {}) {
    this.track = track;
    this.config = {
      mode: config.mode ?? 'race',
      totalLaps: config.totalLaps ?? 3,
      difficulty: config.difficulty ?? 'pro',
      playerCarId: config.playerCarId ?? 'cannibal',
      aiCount: config.aiCount ?? (config.mode === 'timeattack' ? 0 : 3),
    };

    this.player = this.createRacer('player', 'JOGADOR', true, this.config.playerCarId, 0, 0);
    this.setupGrid();
  }

  private createRacer(
    id: string,
    name: string,
    isPlayer: boolean,
    carId: CarId,
    gridIndex: number,
    laneOffset: number
  ): Racer {
    const stats = getCarStats(carId);

    // Posicionamento no Grid de Largada (fileira dupla escalonada atrás da linha de chegada)
    const row = Math.floor(gridIndex / 2);
    const col = gridIndex % 2; // 0 = esquerda, 1 = direita

    const startDist = (this.track.totalLength - 12 - row * 10) % this.track.totalLength;
    const startPoint = sampleTrackAtDistance(this.track, startDist);

    const sideSign = col === 0 ? 1 : -1;
    const posX = startPoint.x + startPoint.normalX * (4 * sideSign);
    const posY = startPoint.y + startPoint.normalY * (4 * sideSign);

    const state = createDefaultVehicleState(stats, {
      x: posX,
      y: posY,
      angle: startPoint.angle,
    });

    const fuelSystem = new FuelSystem(stats.fuelTank, stats.fuelConsumption, 35);
    const nitroSystem = new NitroSystem(3, stats.nitroDuration);
    const lapTracker = createLapTracker(this.config.totalLaps);

    const racer: Racer = {
      id,
      name,
      isPlayer,
      carId,
      stats,
      state,
      lapTracker,
      fuelSystem,
      nitroSystem,
      pitManager: new PitManager(),
      finishTime: null,
      finishRank: null,
      currentRank: gridIndex + 1,
    };

    if (!isPlayer) {
      racer.aiController = new AICarController(laneOffset);
    }

    return racer;
  }

  private setupGrid(): void {
    this.racers = [];
    this.finishCounter = 0;
    this.status = 'countdown';
    this.countdownTimer = 3.99;
    this.totalTime = 0;

    if (this.config.mode === 'multiplayer' && this.config.multiplayerPlayers && this.config.multiplayerPlayers.length > 0) {
      for (const mp of this.config.multiplayerPlayers) {
        const laneOffset = mp.slot % 2 === 0 ? -2.5 : 2.5;
        const racer = this.createRacer(
          mp.id,
          mp.name,
          mp.isLocal,
          mp.carId,
          mp.slot,
          laneOffset
        );
        if (mp.isLocal) {
          this.player = racer;
        } else {
          racer.aiController = undefined; // Piloto remoto controlado via rede
        }
        this.racers.push(racer);
      }
    } else {
      // Jogador larga na pole position (gridIndex = 0)
      this.player = this.createRacer('player', 'JOGADOR (VOCÊ)', true, this.config.playerCarId, 0, 0);
      this.racers.push(this.player);

      if (this.config.mode === 'race') {
        const aiCars: { id: CarId; name: string; offset: number }[] = [
          { id: 'sidewinder', name: 'SIDEWINDER (IA)', offset: -2.5 },
          { id: 'razor', name: 'RAZOR (IA)', offset: 2.5 },
          { id: 'weasel', name: 'WEASEL (IA)', offset: 0 },
        ];

        for (let i = 0; i < this.config.aiCount; i++) {
          const aiInfo = aiCars[i % aiCars.length];
          const aiRacer = this.createRacer(
            `ai_${i + 1}`,
            aiInfo.name,
            false,
            aiInfo.id,
            i + 1,
            aiInfo.offset
          );
          this.racers.push(aiRacer);
        }
      }
    }
  }

  public reset(): void {
    this.setupGrid();
  }

  public get countdownDisplay(): string | null {
    if (this.status !== 'countdown') return null;
    if (this.countdownTimer > 3) return '3';
    if (this.countdownTimer > 2) return '2';
    if (this.countdownTimer > 1) return '1';
    return 'GO!';
  }

  public update(playerInput: VehicleInput, dt: number): void {
    // 1. Contagem Regressiva
    if (this.status === 'countdown') {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.status = 'racing';
      } else {
        // Bloqueia movimento durante a contagem
        return;
      }
    }

    if (this.status === 'racing' || this.status === 'finished') {
      this.totalTime += dt;
    }

    const playerProj = projectPositionOnTrack(this.track, this.player.state.x, this.player.state.y);

    // 2. Atualiza todos os pilotos
    for (const racer of this.racers) {
      if (racer.lapTracker.isFinished && racer.finishRank !== null) {
        // Piloto já terminou: aplica desaceleração suave
        racer.state = stepPhysics(
          racer.state,
          { throttle: 0, brake: 0.5, steer: 0, nitro: false },
          racer.stats,
          racer.state.surface,
          dt
        );
        continue;
      }

      // Determina input (Jogador vs IA)
      let input: VehicleInput;
      const proj = projectPositionOnTrack(this.track, racer.state.x, racer.state.y);

      if (racer.isPlayer) {
        input = playerInput;
        if (input.nitro && !racer.nitroSystem.isActive && racer.nitroSystem.charges > 0) {
          racer.nitroSystem.trigger();
        }
      } else if (racer.aiController) {
        input = racer.aiController.computeInput(
          racer.state,
          racer.stats,
          this.track,
          proj.distance,
          playerProj.distance,
          this.config.difficulty,
          dt
        );
        if (input.nitro && !racer.nitroSystem.isActive && racer.nitroSystem.charges > 0) {
          racer.nitroSystem.trigger();
        }
      } else {
        // Piloto remoto: sincronizado via WebSocket
        racer.lapTracker = updateLapTracker(racer.lapTracker, proj.progress, dt);
        if (racer.lapTracker.isFinished && racer.finishRank === null) {
          this.finishCounter += 1;
          racer.finishRank = this.finishCounter;
          racer.finishTime = this.totalTime;
        }
        continue;
      }

      racer.nitroSystem.update(dt);

      if (input.throttle > 0) {
        racer.fuelSystem.consume(input.throttle, racer.nitroSystem.isActive, dt);
      }

      racer.pitManager.update(proj.isOnPitLane, racer.fuelSystem, dt);

      let surface: SurfaceType = 'asphalt';
      if (proj.isOnPitLane) {
        surface = 'pit';
      } else if (proj.isOffTrack) {
        surface = 'grass';
      }

      racer.state.surface = surface;
      racer.state.fuel = racer.fuelSystem.current;
      racer.state.nitroTimer = racer.nitroSystem.timer;
      racer.state.isOutOfFuel = racer.fuelSystem.isEmpty;

      const simInput: VehicleInput = {
        ...input,
        nitro: racer.nitroSystem.isActive,
      };

      const prevLap = racer.lapTracker.currentLap;
      racer.state = stepPhysics(racer.state, simInput, racer.stats, surface, dt);
      racer.lapTracker = updateLapTracker(racer.lapTracker, proj.progress, dt);

      // Recarga de nitro por volta
      if (racer.lapTracker.currentLap > prevLap) {
        racer.nitroSystem.rechargeOnNewLap(1);
      }

      // Verifica chegada
      if (racer.lapTracker.isFinished && racer.finishRank === null) {
        this.finishCounter += 1;
        racer.finishRank = this.finishCounter;
        racer.finishTime = this.totalTime;

        if (racer.isPlayer) {
          this.status = 'finished';
        }
      }
    }

    // 2.5 Cálculo de Vácuo Aerodinâmico (Slipstream / Drafting)
    this.isPlayerInSlipstream = false;
    for (const lead of this.racers) {
      if (lead.id === this.player.id) continue;
      const slip = calculateSlipstream(lead.state, this.player.state);
      if (slip.inSlipstream) {
        this.isPlayerInSlipstream = true;
        // Bônus de vácuo: reduz o arrasto e aumenta a aceleração
        this.player.state.speed += (slip.boostFactor - 1.0) * 16.0 * dt;
        break;
      }
    }

    // 3. Resolução de Colisões entre Veículos (Arcade Bump Physics)
    this.lastCollisionImpulse = 0;
    const numRacers = this.racers.length;
    for (let i = 0; i < numRacers; i++) {
      for (let j = i + 1; j < numRacers; j++) {
        const racerA = this.racers[i];
        const racerB = this.racers[j];
        const col = resolveVehicleCollision(racerA.state, racerB.state);
        if (col.hasCollided && (racerA.isPlayer || racerB.isPlayer)) {
          this.lastCollisionImpulse = Math.max(this.lastCollisionImpulse, col.impulse);
        }
      }
    }

    // 4. Atualiza Tabela de Classificação em Tempo Real (por progresso total)
    this.updateLeaderboard();
  }

  private updateLeaderboard(): void {
    const sorted = [...this.racers].sort((a, b) => {
      // Pilotos já finalizados são ordenados por ordem de chegada
      if (a.finishRank !== null && b.finishRank !== null) {
        return a.finishRank - b.finishRank;
      }
      if (a.finishRank !== null) return -1;
      if (b.finishRank !== null) return 1;

      // Pilotos na pista: ordenados por progresso total
      return b.lapTracker.totalProgress - a.lapTracker.totalProgress;
    });

    sorted.forEach((racer, index) => {
      racer.currentRank = index + 1;
    });
  }

  public getLeaderboard(): Racer[] {
    return [...this.racers].sort((a, b) => a.currentRank - b.currentRank);
  }
}
