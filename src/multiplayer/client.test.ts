import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  deserializeMessage,
  generateInviteUrl,
  isClientMessage,
  isServerMessage,
  parseRoomFromUrl,
  serializeMessage,
  type ClientMessage,
  type NetworkPlayerInfo,
  type NetworkPlayerState,
  type ServerMessage,
} from './protocol';
import {
  lerp,
  lerpAngle,
  NetworkStateInterpolator,
} from './interpolator';
import { ExponentialBackoff } from './reconnection';
import { MultiplayerClient, DEFAULT_ICE_SERVERS } from './client';
import type { VehicleState } from '../core';

function createDummyState(overrides: Partial<VehicleState> = {}): VehicleState {
  return {
    x: 10,
    y: 20,
    angle: 0,
    speed: 30,
    lateralVelocity: 0,
    fuel: 100,
    isOutOfFuel: false,
    nitroTimer: 0,
    surface: 'asphalt',
    ...overrides,
  };
}

describe('Multiplayer Protocol & Packaging', () => {
  it('testa helper escalar lerp corretamente', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it('serializa e deserializa mensagens de cliente corretamente', () => {
    const msg: ClientMessage = {
      type: 'join_lobby',
      name: 'Ayrton',
      carId: 'cannibal',
      roomCode: 'VELOZ',
    };

    const serialized = serializeMessage(msg);
    expect(typeof serialized).toBe('string');

    const deserialized = deserializeMessage<ClientMessage>(serialized);
    expect(deserialized).toEqual(msg);
  });

  it('valida type guards de mensagens do cliente e do servidor', () => {
    const clientMsg: ClientMessage = {
      type: 'send_state',
      state: createDummyState(),
      lap: 2,
      progress: 0.45,
      nitroActive: true,
      steer: 0.2,
    };

    const serverMsg: ServerMessage = {
      type: 'race_start',
      players: [
        { id: 'p1', name: 'Host', carId: 'cannibal', ready: true, isHost: true, slot: 0 },
      ],
      totalLaps: 3,
    };

    expect(isClientMessage(clientMsg)).toBe(true);
    expect(isServerMessage(serverMsg)).toBe(true);

    expect(isClientMessage({ type: 'invalid_type' })).toBe(false);
    expect(isServerMessage(null)).toBe(false);
    expect(isServerMessage('not an object')).toBe(false);
  });

  it('trata erros de deserialização em payloads corrompidos graciosamente', () => {
    expect(deserializeMessage('{ invalid json ')).toBeNull();
    expect(deserializeMessage(null)).toBeNull();
    expect(deserializeMessage(12345)).toBeNull();
  });

  it('extrai códigos de sala de parâmetros de URL (?room, ?join, ?code, ?roomCode)', () => {
    expect(parseRoomFromUrl('?room=TURBO99')).toBe('TURBO99');
    expect(parseRoomFromUrl('?join=SALA123')).toBe('SALA123');
    expect(parseRoomFromUrl('?code=SPEED')).toBe('SPEED');
    expect(parseRoomFromUrl('?roomCode=LEADER')).toBe('LEADER');
    expect(parseRoomFromUrl('room=lower77')).toBe('LOWER77');
    expect(parseRoomFromUrl('?other=123')).toBeNull();
    expect(parseRoomFromUrl('')).toBeNull();
  });

  it('gera URL compartilhável de convite com formatação limpa', () => {
    const url = generateInviteUrl('SALA99', 'https://topgear.game/race');
    expect(url).toBe('https://topgear.game/race/?join=SALA99');
  });
});

describe('Smooth Interpolation & Dead Reckoning (NetworkStateInterpolator)', () => {
  it('interpola ângulos pelo caminho mais curto sem rotações bruscas de 360 graus', () => {
    // Transição de +3.10 rad para -3.10 rad (distância angular real ~0.08 rad)
    const angleA = Math.PI - 0.04;
    const angleB = -Math.PI + 0.04;

    const midAngle = lerpAngle(angleA, angleB, 0.5);
    // Deve interpolar atravessando a fronteira de PI (~3.14 ou -3.14)
    expect(Math.abs(Math.abs(midAngle) - Math.PI)).toBeLessThan(0.06);
  });

  it('interpola linearmente entre dois snapshots temporais', () => {
    const interpolator = new NetworkStateInterpolator();
    interpolator.interpolationDelayMs = 50;

    const snap0: NetworkPlayerState = {
      id: 'p2',
      state: createDummyState({ x: 0, y: 0, speed: 20 }),
      lap: 1,
      progress: 0.1,
      nitroActive: false,
      steer: 0,
      timestamp: 1000,
    };

    const snap1: NetworkPlayerState = {
      id: 'p2',
      state: createDummyState({ x: 100, y: 50, speed: 40 }),
      lap: 1,
      progress: 0.2,
      nitroActive: true,
      steer: 0.5,
      timestamp: 1100,
    };

    interpolator.pushSnapshot('p2', snap0, 1000);
    interpolator.pushSnapshot('p2', snap1, 1100);

    // Target render time = 1100 (com delay de 50ms -> tempo avaliado = 1050, exatamente 50% entre snap0 e snap1)
    const result = interpolator.getInterpolatedState('p2', 1100);

    expect(result).not.toBeNull();
    expect(result!.state.x).toBeCloseTo(50, 1);
    expect(result!.state.y).toBeCloseTo(25, 1);
    expect(result!.state.speed).toBeCloseTo(30, 1);
    expect(result!.progress).toBeCloseTo(0.15, 2);
    expect(result!.steer).toBeCloseTo(0.25, 2);
    expect(result!.isExtrapolated).toBe(false);
  });

  it('executa Dead Reckoning (extrapolação física) na perda de pacotes / lag spike', () => {
    const interpolator = new NetworkStateInterpolator();
    interpolator.interpolationDelayMs = 0;

    // Carro apontado para o eixo X (angle = 0), velocidade 40 m/s
    const snap: NetworkPlayerState = {
      id: 'p2',
      state: createDummyState({ x: 10, y: 20, angle: 0, speed: 40, lateralVelocity: 0 }),
      lap: 1,
      progress: 0.3,
      nitroActive: false,
      steer: 0,
      timestamp: 1000,
    };

    interpolator.pushSnapshot('p2', snap, 1000);

    // Render time 200ms após o último snapshot (sem novos pacotes recebidos)
    const result = interpolator.getInterpolatedState('p2', 1200);

    expect(result).not.toBeNull();
    expect(result!.isExtrapolated).toBe(true);
    // Extrapolação: x avança ao longo da velocidade vetorial
    expect(result!.state.x).toBeGreaterThan(10);
    expect(result!.state.y).toBeCloseTo(20, 1);
  });

  it('aplica amortecimento progressivo em longos períodos de perda de sinal', () => {
    const interpolator = new NetworkStateInterpolator();
    interpolator.interpolationDelayMs = 0;
    interpolator.maxExtrapolationTimeMs = 1000;

    const snap: NetworkPlayerState = {
      id: 'p2',
      state: createDummyState({ x: 0, y: 0, angle: 0, speed: 50 }),
      lap: 1,
      progress: 0.5,
      nitroActive: false,
      steer: 0,
      timestamp: 1000,
    };

    interpolator.pushSnapshot('p2', snap, 1000);

    // Após 1 segundo de blackout, a velocidade extrapola com amortecimento
    const result1s = interpolator.getInterpolatedState('p2', 2000);
    expect(result1s!.isExtrapolated).toBe(true);
    expect(result1s!.state.speed).toBeLessThan(50);
  });

  it('gerencia múltiplos oponentes e limpa buffers ao desconectar', () => {
    const interpolator = new NetworkStateInterpolator();
    const snapA: NetworkPlayerState = {
      id: 'pA',
      state: createDummyState(),
      lap: 1,
      progress: 0,
      nitroActive: false,
      steer: 0,
      timestamp: 100,
    };
    const snapB: NetworkPlayerState = {
      id: 'pB',
      state: createDummyState(),
      lap: 1,
      progress: 0,
      nitroActive: false,
      steer: 0,
      timestamp: 100,
    };

    interpolator.pushSnapshot('pA', snapA);
    interpolator.pushSnapshot('pB', snapB);

    expect(interpolator.getBufferSize('pA')).toBe(1);
    expect(interpolator.getBufferSize('pB')).toBe(1);

    interpolator.removePlayer('pA');
    expect(interpolator.getBufferSize('pA')).toBe(0);
    expect(interpolator.getBufferSize('pB')).toBe(1);

    interpolator.clear();
    expect(interpolator.getBufferSize('pB')).toBe(0);
  });
});

describe('Exponential Backoff Reconnection', () => {
  it('calcula atrasos crescentes exponencialmente com fator multiplicativo', () => {
    const backoff = new ExponentialBackoff({
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      factor: 2,
      jitterMs: 0,
      maxRetries: 4,
    });

    expect(backoff.getDelay(0)).toBe(1000);
    expect(backoff.getDelay(1)).toBe(2000);
    expect(backoff.getDelay(2)).toBe(4000);
    expect(backoff.getDelay(3)).toBe(8000);
    // Respeita o limite máximo de delay
    expect(backoff.getDelay(4)).toBe(10000);
  });

  it('respeita o limite máximo de tentativas de reconexão', () => {
    const backoff = new ExponentialBackoff({ maxRetries: 3 });

    expect(backoff.canRetry(0)).toBe(true);
    expect(backoff.canRetry(1)).toBe(true);
    expect(backoff.canRetry(2)).toBe(true);
    expect(backoff.canRetry(3)).toBe(false);
    expect(backoff.canRetry(4)).toBe(false);
  });

  it('reseta o contador de tentativas após conexão bem-sucedida', () => {
    const backoff = new ExponentialBackoff();
    backoff.nextAttempt();
    backoff.nextAttempt();
    expect(backoff.attempt).toBe(2);

    backoff.reset();
    expect(backoff.attempt).toBe(0);
  });
});

describe('MultiplayerClient Core Architecture', () => {
  let client: MultiplayerClient;

  beforeEach(() => {
    client = new MultiplayerClient();
  });

  it('inicia no estado desconectado com servidores STUN padrão de alta disponibilidade', () => {
    expect(client.isConnected).toBe(false);
    expect(client.connectionStatus).toBe('disconnected');
    expect(client.playerId).toBeNull();
    expect(DEFAULT_ICE_SERVERS.length).toBeGreaterThanOrEqual(2);
    expect(DEFAULT_ICE_SERVERS.some((s) => JSON.stringify(s).includes('stun.l.google.com'))).toBe(true);
  });

  it('gera código de sala alfanumérico seguro de 5 caracteres', () => {
    const code1 = client.generateRoomCode();
    const code2 = client.generateRoomCode();

    expect(code1.length).toBe(5);
    expect(code2.length).toBe(5);
    expect(typeof code1).toBe('string');
  });

  it('processa mensagens do servidor e aciona callbacks de lobby e corrida', () => {
    const lobbyCb = vi.fn();
    const raceStartCb = vi.fn();
    const collisionCb = vi.fn();
    const finishCb = vi.fn();

    client.onLobbyUpdateCallback = lobbyCb;
    client.onRaceStartCallback = raceStartCb;
    client.onRemoteCollisionCallback = collisionCb;
    client.onPlayerFinishedCallback = finishCb;

    // Welcome
    client.handleServerMessage({ type: 'welcome', playerId: 'p123', isHost: true, roomCode: 'ROOM1' });
    expect(client.playerId).toBe('p123');
    expect(client.isHost).toBe(true);
    expect(client.roomCode).toBe('ROOM1');

    // Lobby Update
    const players: NetworkPlayerInfo[] = [
      { id: 'p123', name: 'Host', carId: 'cannibal', ready: true, isHost: true, slot: 0 },
    ];
    client.handleServerMessage({ type: 'lobby_update', players, canStart: true, roomCode: 'ROOM1' });
    expect(lobbyCb).toHaveBeenCalledWith(players, true, 'ROOM1');

    // Race Start
    client.handleServerMessage({ type: 'race_start', players, totalLaps: 3, trackId: 'las_vegas' });
    expect(raceStartCb).toHaveBeenCalledWith(players, 3, 'las_vegas');

    // Collision
    client.handleServerMessage({ type: 'remote_collision', sourceId: 'p2', targetId: 'p123', impulse: 1.5, x: 10, y: 20 });
    expect(collisionCb).toHaveBeenCalledWith('p2', 'p123', 1.5, 10, 20);

    // Finish
    client.handleServerMessage({ type: 'player_finished', playerId: 'p2', rank: 2, totalTime: 45.2 });
    expect(finishCb).toHaveBeenCalledWith('p2', 2, 45.2);
  });

  it('alimenta automaticamente o interpolador no recebimento de world_sync', () => {
    client.playerId = 'local_player';
    const remoteState: NetworkPlayerState = {
      id: 'remote_opponent',
      state: createDummyState({ x: 50, y: 100 }),
      lap: 2,
      progress: 0.5,
      nitroActive: false,
      steer: 0,
      timestamp: 1000,
    };

    client.handleServerMessage({
      type: 'world_sync',
      players: [
        { id: 'local_player', state: createDummyState(), lap: 1, progress: 0, nitroActive: false, steer: 0, timestamp: 1000 },
        remoteState,
      ],
    });

    const interpolated = client.getInterpolatedState('remote_opponent', 1000);
    expect(interpolated).not.toBeNull();
    expect(interpolated!.state.x).toBe(50);
    expect(interpolated!.state.y).toBe(100);
  });

  it('desconecta e limpa recursos de rede e interpoladores', () => {
    client.roomCode = 'ABCDE';
    client.playerId = 'test_id';
    client.isConnected = true;

    client.disconnect();

    expect(client.isConnected).toBe(false);
    expect(client.connectionStatus).toBe('disconnected');
    expect(client.roomCode).toBeNull();
    expect(client.playerId).toBeNull();
  });
});
