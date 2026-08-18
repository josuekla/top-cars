import type { CarId, VehicleState } from '../core';

export interface NetworkPlayerInfo {
  id: string;
  name: string;
  carId: CarId;
  ready: boolean;
  isHost: boolean;
  slot: number;
}

export interface NetworkPlayerState {
  id: string;
  state: VehicleState;
  lap: number;
  progress: number;
  nitroActive: boolean;
  steer: number;
  timestamp: number;
}

export type ClientMessage =
  | { type: 'join_lobby'; name: string; carId: CarId }
  | { type: 'set_ready'; ready: boolean; carId: CarId }
  | { type: 'start_race' }
  | { type: 'send_state'; state: VehicleState; lap: number; progress: number; nitroActive: boolean; steer: number }
  | { type: 'collision_event'; targetId: string; impulse: number }
  | { type: 'finish_race'; totalTime: number; bestLapTime: number | null };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; isHost: boolean }
  | { type: 'lobby_update'; players: NetworkPlayerInfo[]; canStart: boolean }
  | { type: 'race_start_countdown'; countdown: number }
  | { type: 'race_start'; players: NetworkPlayerInfo[]; totalLaps: number }
  | { type: 'world_sync'; players: NetworkPlayerState[] }
  | { type: 'remote_collision'; sourceId: string; targetId: string; impulse: number }
  | { type: 'player_disconnected'; playerId: string };
