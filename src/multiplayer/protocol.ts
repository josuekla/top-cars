import type { CarId, VehicleState } from '../core';

export interface NetworkPlayerInfo {
  id: string;
  name: string;
  carId: CarId;
  ready: boolean;
  isHost: boolean;
  slot: number;
  ping?: number;
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
  | { type: 'join_lobby'; name: string; carId: CarId; roomCode?: string }
  | { type: 'set_ready'; ready: boolean; carId: CarId }
  | { type: 'start_race'; trackId?: string }
  | { type: 'send_state'; state: VehicleState; lap: number; progress: number; nitroActive: boolean; steer: number; timestamp?: number }
  | { type: 'collision_event'; targetId: string; impulse: number; x?: number; y?: number }
  | { type: 'finish_race'; totalTime: number; bestLapTime: number | null; rank?: number }
  | { type: 'ping'; clientTime: number }
  | { type: 'pong'; clientTime: number; serverTime: number };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; isHost: boolean; roomCode?: string }
  | { type: 'lobby_update'; players: NetworkPlayerInfo[]; canStart: boolean; roomCode?: string }
  | { type: 'race_start_countdown'; countdown: number }
  | { type: 'race_start'; players: NetworkPlayerInfo[]; totalLaps: number; trackId?: string; startTime?: number }
  | { type: 'world_sync'; players: NetworkPlayerState[]; timestamp?: number }
  | { type: 'remote_collision'; sourceId: string; targetId: string; impulse: number; x?: number; y?: number }
  | { type: 'player_disconnected'; playerId: string }
  | { type: 'player_finished'; playerId: string; rank: number; totalTime: number }
  | { type: 'ping'; serverTime: number }
  | { type: 'pong'; clientTime: number; serverTime: number };

/**
 * Serializa uma mensagem de rede em string JSON
 */
export function serializeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

/**
 * Deserializa com segurança uma mensagem recebida
 */
export function deserializeMessage<T = ClientMessage | ServerMessage>(raw: unknown): T | null {
  if (typeof raw === 'object' && raw !== null && 'type' in raw) {
    return raw as T;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        return parsed as T;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Type guard para validar mensagens enviadas pelo cliente
 */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  const validTypes = ['join_lobby', 'set_ready', 'start_race', 'send_state', 'collision_event', 'finish_race', 'ping', 'pong'];
  return typeof m.type === 'string' && validTypes.includes(m.type);
}

/**
 * Type guard para validar mensagens emitidas pelo servidor/host
 */
export function isServerMessage(msg: unknown): msg is ServerMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as Record<string, unknown>;
  const validTypes = [
    'welcome',
    'lobby_update',
    'race_start_countdown',
    'race_start',
    'world_sync',
    'remote_collision',
    'player_disconnected',
    'player_finished',
    'ping',
    'pong',
  ];
  return typeof m.type === 'string' && validTypes.includes(m.type);
}

/**
 * Extrai o código da sala de uma URL ou query string
 * Suporta: ?room=XYZ, ?join=XYZ, ?code=XYZ, ?roomCode=XYZ
 */
export function parseRoomFromUrl(searchQuery?: string): string | null {
  const query = searchQuery !== undefined ? searchQuery : (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return null;

  const params = new URLSearchParams(query.startsWith('?') ? query : `?${query}`);
  const code = params.get('room') || params.get('join') || params.get('code') || params.get('roomCode');
  return code ? code.trim().toUpperCase() : null;
}

/**
 * Gera uma URL compartilhável para convidar amigos diretamente para a sala
 */
export function generateInviteUrl(roomCode: string, baseUrl?: string): string {
  const cleanCode = roomCode.trim().toUpperCase();
  const base = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://topgear-legado.vercel.app/');
  const cleanBase = base.split('?')[0].replace(/\/$/, '');
  return `${cleanBase}/?join=${encodeURIComponent(cleanCode)}`;
}

