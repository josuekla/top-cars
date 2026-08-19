import { Peer, type DataConnection } from 'peerjs';
import type { CarId, VehicleState } from '../core';
import {
  type ClientMessage,
  type NetworkPlayerInfo,
  type NetworkPlayerState,
  type ServerMessage,
  deserializeMessage,
  generateInviteUrl,
  parseRoomFromUrl,
  serializeMessage,
} from './protocol';
import { NetworkStateInterpolator, type InterpolatedPlayerState } from './interpolator';
import { ExponentialBackoff, type BackoffConfig } from './reconnection';

export type MultiplayerTransport = 'webrtc' | 'websocket';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface ConnectedPeer {
  conn: DataConnection;
  info: NetworkPlayerInfo;
  latestState?: NetworkPlayerState;
}

export interface ClientConfig {
  iceServers?: RTCIceServer[];
  backoff?: Partial<BackoffConfig>;
  interpolationDelayMs?: number;
  maxExtrapolationTimeMs?: number;
}

export const PEER_PREFIX = 'tglegado-';

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' },
];

export interface NetworkDiagnosticsInfo {
  iceState: string;
  dataChannel: string;
  peersCount: number;
  lastRtt?: number;
}

export class MultiplayerClient {
  public transport: MultiplayerTransport = 'webrtc';
  public playerId: string | null = null;
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public connectionStatus: ConnectionStatus = 'disconnected';
  public roomCode: string | null = null;
  public statusMessage: string = 'Desconectado';

  // Diagnóstico de Conexão WebRTC
  public diagnostics: NetworkDiagnosticsInfo = {
    iceState: 'idle',
    dataChannel: 'fechado',
    peersCount: 0,
  };

  // Motor de interpolação e predição (Dead Reckoning + LERP 60 FPS)
  public interpolator: NetworkStateInterpolator = new NetworkStateInterpolator();

  // Gerenciador de reconexão exponencial
  public backoff: ExponentialBackoff = new ExponentialBackoff();

  // Callbacks de Eventos do Jogo
  public onLobbyUpdateCallback?: (players: NetworkPlayerInfo[], canStart: boolean, roomCode?: string) => void;
  public onRaceStartCallback?: (players: NetworkPlayerInfo[], totalLaps: number, trackId?: string) => void;
  public onWorldSyncCallback?: (players: NetworkPlayerState[]) => void;
  public onRemoteCollisionCallback?: (sourceId: string, targetId: string, impulse: number, x?: number, y?: number) => void;
  public onPlayerFinishedCallback?: (playerId: string, rank: number, totalTime: number) => void;
  public onStatusChangeCallback?: (msg: string, isError: boolean) => void;
  public onConnectionStatusChangeCallback?: (status: ConnectionStatus) => void;
  public onDiagnosticsUpdateCallback?: (diag: NetworkDiagnosticsInfo) => void;

  // Estados Internos do WebRTC (PeerJS)
  private peer: Peer | null = null;
  private guestConn: DataConnection | null = null;
  private hostPeers: Map<string, ConnectedPeer> = new Map();
  private localPlayerInfo: NetworkPlayerInfo | null = null;
  private localLatestState?: NetworkPlayerState;
  private hostSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isRacing: boolean = false;

  // Estados Internos do WebSocket
  private ws: WebSocket | null = null;
  private lastWsUrl: string | null = null;

  // Estados de Sessão para Auto-Reconexão
  private lastSessionName: string = 'Piloto';
  private lastSessionCarId: CarId = 'cannibal';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isManualDisconnect: boolean = false;
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;

  constructor(config?: ClientConfig) {
    if (config?.iceServers) {
      this.iceServers = config.iceServers;
    }
    if (config?.backoff) {
      this.backoff = new ExponentialBackoff(config.backoff);
    }
    if (config?.interpolationDelayMs !== undefined) {
      this.interpolator.interpolationDelayMs = config.interpolationDelayMs;
    }
    if (config?.maxExtrapolationTimeMs !== undefined) {
      this.interpolator.maxExtrapolationTimeMs = config.maxExtrapolationTimeMs;
    }
  }

  public updateDiagnostics(partial: Partial<NetworkDiagnosticsInfo>): void {
    this.diagnostics = { ...this.diagnostics, ...partial };
    if (this.onDiagnosticsUpdateCallback) {
      this.onDiagnosticsUpdateCallback(this.diagnostics);
    }
  }

  public setStatus(msg: string, isError: boolean = false): void {
    this.statusMessage = msg;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(msg, isError);
    }
  }

  public setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.isConnected = status === 'connected';
    if (this.onConnectionStatusChangeCallback) {
      this.onConnectionStatusChangeCallback(status);
    }
  }

  // ==========================================
  // HELPERS DE URL E SALAS
  // ==========================================

  /**
   * Extrai o código da sala de uma URL ou query string
   */
  public static parseRoomFromUrl(search?: string): string | null {
    return parseRoomFromUrl(search);
  }

  /**
   * Retorna a URL compartilhável para convidar amigos para a sala atual
   */
  public getInviteUrl(origin?: string): string | null {
    if (!this.roomCode) return null;
    return generateInviteUrl(this.roomCode, origin);
  }

  // ==========================================
  // MODO 1: WebRTC P2P (PeerJS - 100% Serverless)
  // ==========================================

  /**
   * Cria uma sala WebRTC e atua como Host (Serverless Hub).
   */
  public createP2PRoom(name: string, carId: CarId, customRoomCode?: string): Promise<string> {
    this.clearReconnectTimer();
    this.isManualDisconnect = false;
    this.cleanupTransports();

    this.transport = 'webrtc';
    this.isHost = true;
    this.lastSessionName = name;
    this.lastSessionCarId = carId;
    this.setConnectionStatus('connecting');
    this.updateDiagnostics({
      iceState: 'conectando STUN/broker...',
      dataChannel: 'aguardando peer',
      peersCount: 1,
    });
    this.setStatus('Conectando aos servidores STUN/broker WebRTC...');

    return new Promise((resolve, reject) => {
      const code = (customRoomCode || this.generateRoomCode()).trim().toUpperCase();
      this.roomCode = code;
      const peerId = `${PEER_PREFIX}${code.toLowerCase()}`;

      try {
        this.peer = new Peer(peerId, {
          config: {
            iceServers: this.iceServers,
          },
        });

        this.peer.on('open', (id) => {
          console.log(`[WebRTC Multiplayer Host] Peer aberto com sucesso. ID Broker: ${id}, Sala: ${code}`);
          this.setConnectionStatus('connected');
          this.backoff.reset();
          this.playerId = `host_${Math.random().toString(36).substring(2, 7)}`;

          this.localPlayerInfo = {
            id: this.playerId,
            name: name || 'Piloto 1 (Host)',
            carId,
            ready: true,
            isHost: true,
            slot: 0,
          };

          this.updateDiagnostics({
            iceState: 'online (host pronto)',
            dataChannel: 'aguardando oponente',
            peersCount: 1,
          });

          this.setStatus(`Sala online criada: ${code} (Aguardando desafiante...)`);
          this.triggerLobbyUpdate();
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingPeerConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.error('[WebRTC Host Peer Error]', err);
          const errorMsg = err.type === 'unavailable-id'
            ? `O código de sala ${code} já está em uso. Tente outro código.`
            : `Erro no WebRTC: ${err.message || err.type}`;

          this.updateDiagnostics({ iceState: 'erro' });
          this.setStatus(errorMsg, true);
          if (this.connectionStatus === 'connecting') {
            this.setConnectionStatus('failed');
            this.cleanupTransports();
            reject(new Error(errorMsg));
          } else {
            this.handleUnexpectedDisconnection();
          }
        });

        this.peer.on('disconnected', () => {
          console.warn('[WebRTC Multiplayer Host] Broker desconectado. Tentando reconectar...');
          this.setStatus('Sinalização WebRTC desconectada. Tentando reconectar broker...');
          if (!this.isManualDisconnect && this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        });

        this.peer.on('close', () => {
          console.log('[WebRTC Multiplayer Host] Peer fechado.');
          if (!this.isManualDisconnect) {
            this.handleUnexpectedDisconnection();
          }
        });
      } catch (err) {
        this.setConnectionStatus('failed');
        this.setStatus('Falha ao inicializar WebRTC Peer.', true);
        reject(err);
      }
    });
  }

  /**
   * Conecta a uma sala WebRTC existente como Convidado (Guest).
   */
  public joinP2PRoom(roomCode: string, name: string, carId: CarId): Promise<void> {
    this.clearReconnectTimer();
    this.isManualDisconnect = false;
    this.cleanupTransports();

    this.transport = 'webrtc';
    this.isHost = false;
    this.lastSessionName = name;
    this.lastSessionCarId = carId;

    const cleanCode = roomCode.trim().toUpperCase();
    this.roomCode = cleanCode;
    const hostPeerId = `${PEER_PREFIX}${cleanCode.toLowerCase()}`;

    this.setConnectionStatus('connecting');
    this.updateDiagnostics({
      iceState: 'buscando sala STUN...',
      dataChannel: 'conectando...',
      peersCount: 1,
    });
    this.setStatus(`Buscando sala ${cleanCode} via WebRTC STUN...`);

    return new Promise((resolve, reject) => {
      let isResolved = false;

      try {
        this.peer = new Peer({
          config: {
            iceServers: this.iceServers,
          },
        });

        const connectionTimeout = setTimeout(() => {
          if (!isResolved) {
            const timeoutMsg = `Tempo limite ao conectar à sala ${cleanCode}. Verifique se o Host está online.`;
            this.setStatus(timeoutMsg, true);
            this.setConnectionStatus('failed');
            this.updateDiagnostics({ iceState: 'timeout' });
            this.cleanupTransports();
            reject(new Error(timeoutMsg));
          }
        }, 14000);

        this.peer.on('open', (id) => {
          console.log(`[WebRTC Multiplayer Guest] Peer criado com ID ${id}. Conectando ao Host ${hostPeerId}...`);
          this.updateDiagnostics({
            iceState: 'conectando ao host...',
            dataChannel: 'abrindo DataChannel...',
          });

          const conn = this.peer!.connect(hostPeerId, {
            reliable: true,
          });

          this.guestConn = conn;

          const onGuestOpen = () => {
            clearTimeout(connectionTimeout);
            isResolved = true;
            this.setConnectionStatus('connected');
            this.backoff.reset();
            this.updateDiagnostics({
              iceState: 'conectado',
              dataChannel: 'aberto (P2P ativo)',
              peersCount: 2,
            });
            console.log(`[WebRTC Multiplayer Guest] DataChannel aberto com Host (${hostPeerId}). Enviando join_lobby: nome=${name}, carro=${carId}`);
            this.setStatus(`Conectado à sala ${cleanCode}!`);
            this.send({ type: 'join_lobby', name, carId, roomCode: cleanCode });
            resolve();
          };

          if (conn.open) {
            onGuestOpen();
          } else {
            conn.on('open', onGuestOpen);
          }

          conn.on('data', (raw) => {
            this.handleServerMessage(raw);
          });

          conn.on('close', () => {
            console.warn('[WebRTC Multiplayer Guest] Conexão com o Host encerrada.');
            this.updateDiagnostics({ dataChannel: 'fechado', iceState: 'desconectado' });
            this.setStatus('Conexão com o Host encerrada.', true);
            if (!this.isManualDisconnect) {
              this.handleUnexpectedDisconnection();
            }
          });

          conn.on('error', (err) => {
            clearTimeout(connectionTimeout);
            console.error('[WebRTC Guest Connection Error]', err);
            this.updateDiagnostics({ dataChannel: 'erro', iceState: 'falha' });
            this.setStatus('Erro na comunicação com o Host da sala.', true);
            if (!isResolved) {
              this.setConnectionStatus('failed');
              reject(err);
            }
          });
        });

        this.peer.on('error', (err: any) => {
          clearTimeout(connectionTimeout);
          console.error('[WebRTC Guest Peer Error]', err);
          const errorMsg = err.type === 'peer-unavailable'
            ? `Sala "${cleanCode}" não encontrada. Verifique o código com o Host.`
            : `Erro WebRTC: ${err.message || err.type}`;

          this.updateDiagnostics({ iceState: 'erro peer' });
          this.setStatus(errorMsg, true);
          if (!isResolved) {
            this.setConnectionStatus('failed');
            this.cleanupTransports();
            reject(new Error(errorMsg));
          } else {
            this.handleUnexpectedDisconnection();
          }
        });

        this.peer.on('disconnected', () => {
          console.warn('[WebRTC Multiplayer Guest] Broker desconectado. Tentando reconectar...');
          if (!this.isManualDisconnect && this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        });
      } catch (err) {
        this.setConnectionStatus('failed');
        this.setStatus('Falha ao iniciar cliente WebRTC.', true);
        reject(err);
      }
    });
  }

  /**
   * Manipula conexões recebidas pelo Host
   */
  private handleIncomingPeerConnection(conn: DataConnection): void {
    const peerPlayerId = `player_${this.hostPeers.size + 2}_${Math.random().toString(36).substring(2, 6)}`;

    console.log(`[WebRTC Multiplayer Host] Nova conexão P2P recebida de ${conn.peer}. Criando jogador ${peerPlayerId}`);

    const peerInfo: NetworkPlayerInfo = {
      id: peerPlayerId,
      name: 'Piloto Desafiante',
      carId: 'sidewinder',
      ready: false,
      isHost: false,
      slot: this.hostPeers.size + 1,
    };

    const connectedPeer: ConnectedPeer = {
      conn,
      info: peerInfo,
    };

    this.hostPeers.set(peerPlayerId, connectedPeer);
    this.updateDiagnostics({
      peersCount: this.getAllNetworkPlayers().length,
      dataChannel: 'conectando peer...',
    });

    const onHostOpen = () => {
      console.log(`[WebRTC Multiplayer Host] DataChannel aberto com ${conn.peer} (${peerPlayerId}). Enviando welcome e lobby_update.`);
      this.updateDiagnostics({
        dataChannel: 'aberto (P2P ativo)',
        iceState: 'conectado',
        peersCount: this.getAllNetworkPlayers().length,
      });

      // Envia boas-vindas com ID e código da sala
      conn.send({
        type: 'welcome',
        playerId: peerPlayerId,
        isHost: false,
        roomCode: this.roomCode || undefined,
      } as ServerMessage);

      this.triggerLobbyUpdate();
      this.setStatus(`${peerInfo.name} entrou na sala!`);
    };

    if (conn.open) {
      onHostOpen();
    } else {
      conn.on('open', onHostOpen);
    }

    conn.on('data', (raw) => {
      try {
        const msg = deserializeMessage<ClientMessage>(raw);
        if (!msg) return;

        if (msg.type === 'join_lobby') {
          console.log(`[WebRTC Multiplayer Host] join_lobby recebido de ${peerPlayerId}: ${msg.name} - ${msg.carId}`);
          connectedPeer.info.name = msg.name || connectedPeer.info.name;
          connectedPeer.info.carId = msg.carId || connectedPeer.info.carId;
          this.triggerLobbyUpdate();
        } else if (msg.type === 'set_ready') {
          console.log(`[WebRTC Multiplayer Host] set_ready recebido de ${peerPlayerId}: ready=${msg.ready}, carId=${msg.carId}`);
          connectedPeer.info.ready = msg.ready;
          connectedPeer.info.carId = msg.carId;
          this.triggerLobbyUpdate();
        } else if (msg.type === 'send_state') {
          const stateSnap: NetworkPlayerState = {
            id: peerPlayerId,
            state: msg.state,
            lap: msg.lap,
            progress: msg.progress,
            nitroActive: msg.nitroActive,
            steer: msg.steer,
            timestamp: msg.timestamp || (typeof performance !== 'undefined' ? performance.now() : Date.now()),
          };
          connectedPeer.latestState = stateSnap;
          this.interpolator.pushSnapshot(peerPlayerId, stateSnap);
        } else if (msg.type === 'collision_event') {
          this.broadcastServerMessage(
            {
              type: 'remote_collision',
              sourceId: peerPlayerId,
              targetId: msg.targetId,
              impulse: msg.impulse,
              x: msg.x,
              y: msg.y,
            },
            peerPlayerId
          );
          if (this.onRemoteCollisionCallback) {
            this.onRemoteCollisionCallback(peerPlayerId, msg.targetId, msg.impulse, msg.x, msg.y);
          }
        } else if (msg.type === 'finish_race') {
          this.broadcastServerMessage({
            type: 'player_finished',
            playerId: peerPlayerId,
            rank: msg.rank || (this.hostPeers.size + 1),
            totalTime: msg.totalTime,
          });
          if (this.onPlayerFinishedCallback) {
            this.onPlayerFinishedCallback(peerPlayerId, msg.rank || 1, msg.totalTime);
          }
        } else if (msg.type === 'ping') {
          conn.send({
            type: 'pong',
            clientTime: msg.clientTime,
            serverTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
          } as ServerMessage);
        }
      } catch (err) {
        console.error('[Host Error Processing Guest Message]', err);
      }
    });

    conn.on('close', () => {
      console.log(`[WebRTC Multiplayer Host] DataConnection fechada para ${peerPlayerId}`);
      this.hostPeers.delete(peerPlayerId);
      this.interpolator.removePlayer(peerPlayerId);
      this.broadcastServerMessage({ type: 'player_disconnected', playerId: peerPlayerId });
      this.triggerLobbyUpdate();
      this.updateDiagnostics({
        peersCount: this.getAllNetworkPlayers().length,
      });
      this.setStatus(`Piloto desconectou da sala.`);
    });
  }

  // ==========================================
  // MODO 2: WebSocket Relay (Node / Render / Dev)
  // ==========================================

  public connect(customUrl?: string): Promise<void> {
    return this.connectWebSocket(customUrl);
  }

  public connectWebSocket(customUrl?: string): Promise<void> {
    this.clearReconnectTimer();
    this.isManualDisconnect = false;
    this.cleanupTransports();

    // Na Vercel (sem servidor WebSocket dedicado), não tenta abrir ws local na CDN
    const isStaticDeploy = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('github.io'));
    if (!customUrl && isStaticDeploy) {
      const msg = 'Multiplayer online na Vercel opera via WebRTC P2P (PeerJS).';
      this.setStatus(msg, false);
      return Promise.reject(new Error(msg));
    }

    this.transport = 'websocket';
    this.setConnectionStatus('connecting');
    this.setStatus('Conectando ao servidor WebSocket Relay...');

    return new Promise((resolve, reject) => {
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
      const wsUrl = customUrl || `${protocol}//${defaultHost}/ws`;
      this.lastWsUrl = wsUrl;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.setConnectionStatus('connected');
          this.backoff.reset();
          this.setStatus(`Conectado ao servidor WebSocket (${wsUrl})`);
          resolve();
        };

        this.ws.onerror = (err) => {
          this.setStatus('Erro ao comunicar com o servidor WebSocket.', true);
          if (this.connectionStatus === 'connecting') {
            this.setConnectionStatus('failed');
            reject(err);
          }
        };

        this.ws.onclose = () => {
          if (!this.isManualDisconnect) {
            this.handleUnexpectedDisconnection();
          } else {
            this.setConnectionStatus('disconnected');
            this.setStatus('Servidor WebSocket desconectado.');
          }
        };

        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };
      } catch (e) {
        this.setConnectionStatus('failed');
        this.setStatus('Falha ao instanciar conexão WebSocket.', true);
        reject(e);
      }
    });
  }

  // ==========================================
  // PROCESSAMENTO DE MENSAGENS E RECONEXÃO
  // ==========================================

  public handleServerMessage(raw: unknown): void {
    try {
      const msg = deserializeMessage<ServerMessage>(raw);
      if (!msg) return;

      if (msg.type === 'welcome') {
        this.playerId = msg.playerId;
        this.isHost = msg.isHost;
        if (msg.roomCode) {
          this.roomCode = msg.roomCode;
        }
      } else if (msg.type === 'lobby_update') {
        if (msg.roomCode) {
          this.roomCode = msg.roomCode;
        }
        if (this.onLobbyUpdateCallback) {
          this.onLobbyUpdateCallback(msg.players, msg.canStart, this.roomCode || undefined);
        }
      } else if (msg.type === 'race_start') {
        this.isRacing = true;
        if (this.onRaceStartCallback) {
          this.onRaceStartCallback(msg.players, msg.totalLaps, msg.trackId);
        }
      } else if (msg.type === 'world_sync') {
        for (const st of msg.players) {
          if (st.id !== this.playerId) {
            this.interpolator.pushSnapshot(st.id, st);
          }
        }
        if (this.onWorldSyncCallback) {
          this.onWorldSyncCallback(msg.players);
        }
      } else if (msg.type === 'remote_collision') {
        if (this.onRemoteCollisionCallback) {
          this.onRemoteCollisionCallback(msg.sourceId, msg.targetId, msg.impulse, msg.x, msg.y);
        }
      } else if (msg.type === 'player_finished') {
        if (this.onPlayerFinishedCallback) {
          this.onPlayerFinishedCallback(msg.playerId, msg.rank, msg.totalTime);
        }
      } else if (msg.type === 'player_disconnected') {
        this.interpolator.removePlayer(msg.playerId);
      }
    } catch (e) {
      console.error('[Multiplayer Client Message Error]', e);
    }
  }

  /**
   * Trata desconexão inesperada e aciona auto-reconexão com backoff exponencial
   */
  private handleUnexpectedDisconnection(): void {
    if (this.isManualDisconnect) return;

    if (!this.backoff.canRetry()) {
      this.setConnectionStatus('failed');
      this.setStatus('Conexão perdida. Limite máximo de tentativas de reconexão atingido.', true);
      return;
    }

    const attempt = this.backoff.nextAttempt();
    const delay = this.backoff.getDelay(attempt - 1);

    this.setConnectionStatus('reconnecting');
    this.setStatus(`Conexão instável. Reconectando em ${(delay / 1000).toFixed(1)}s (tentativa ${attempt}/${this.backoff.maxRetries})...`, true);

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      if (this.isManualDisconnect) return;

      if (this.transport === 'webrtc') {
        if (this.isHost && this.roomCode) {
          this.createP2PRoom(this.lastSessionName, this.lastSessionCarId, this.roomCode).catch(console.error);
        } else if (!this.isHost && this.roomCode) {
          this.joinP2PRoom(this.roomCode, this.lastSessionName, this.lastSessionCarId).catch(console.error);
        }
      } else if (this.transport === 'websocket') {
        this.connectWebSocket(this.lastWsUrl || undefined)
          .then(() => {
            this.joinLobby(this.lastSessionName, this.lastSessionCarId);
          })
          .catch(console.error);
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ==========================================
  // LOOP DE SINCRONIZAÇÃO E INTERPOLAÇÃO
  // ==========================================

  /**
   * Obtém o estado 60 FPS suavemente interpolado (ou predito via Dead Reckoning) para um piloto remoto
   */
  public getInterpolatedState(playerId: string, renderTime?: number): InterpolatedPlayerState | null {
    return this.interpolator.getInterpolatedState(playerId, renderTime);
  }

  private startHostSyncLoop(): void {
    this.stopHostSyncLoop();
    this.isRacing = true;

    this.hostSyncTimer = setInterval(() => {
      if (!this.isRacing) return;

      const states: NetworkPlayerState[] = [];
      if (this.localLatestState) {
        states.push(this.localLatestState);
      }
      for (const peer of this.hostPeers.values()) {
        if (peer.latestState) {
          states.push(peer.latestState);
        }
      }

      if (states.length > 0) {
        const syncMsg: ServerMessage = {
          type: 'world_sync',
          players: states,
          timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        };
        this.broadcastServerMessage(syncMsg);

        if (this.onWorldSyncCallback) {
          this.onWorldSyncCallback(states);
        }
      }
    }, 1000 / 30);
  }

  private stopHostSyncLoop(): void {
    if (this.hostSyncTimer) {
      clearInterval(this.hostSyncTimer);
      this.hostSyncTimer = null;
    }
    this.isRacing = false;
  }

  private broadcastServerMessage(msg: ServerMessage, excludeId?: string): void {
    const payload = msg;
    for (const [id, peer] of this.hostPeers) {
      if (excludeId && id === excludeId) continue;
      try {
        peer.conn.send(payload);
      } catch (e) {
        console.error(`[Broadcast Error to ${id}]`, e);
      }
    }
  }

  private getAllNetworkPlayers(): NetworkPlayerInfo[] {
    const list: NetworkPlayerInfo[] = [];
    if (this.localPlayerInfo) {
      list.push(this.localPlayerInfo);
    }
    for (const p of this.hostPeers.values()) {
      list.push(p.info);
    }
    return list;
  }

  private triggerLobbyUpdate(): void {
    if (!this.isHost) return;
    const players = this.getAllNetworkPlayers();
    const canStart = players.length >= 2 && players.every((p) => p.ready);

    const updateMsg: ServerMessage = {
      type: 'lobby_update',
      players,
      canStart,
      roomCode: this.roomCode || undefined,
    };

    this.broadcastServerMessage(updateMsg);

    if (this.onLobbyUpdateCallback) {
      this.onLobbyUpdateCallback(players, canStart, this.roomCode || undefined);
    }
  }

  // ==========================================
  // API PÚBLICA DE ENVIO E GERENCIAMENTO
  // ==========================================

  public send(msg: ClientMessage): void {
    if (this.transport === 'websocket') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(serializeMessage(msg));
      }
      return;
    }

    if (this.isHost) {
      if (msg.type === 'set_ready') {
        if (this.localPlayerInfo) {
          this.localPlayerInfo.ready = msg.ready;
          this.localPlayerInfo.carId = msg.carId;
          this.triggerLobbyUpdate();
        }
      } else if (msg.type === 'send_state') {
        this.localLatestState = {
          id: this.playerId || 'host',
          state: msg.state,
          lap: msg.lap,
          progress: msg.progress,
          nitroActive: msg.nitroActive,
          steer: msg.steer,
          timestamp: msg.timestamp || (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        };
      } else if (msg.type === 'collision_event') {
        this.broadcastServerMessage({
          type: 'remote_collision',
          sourceId: this.playerId || 'host',
          targetId: msg.targetId,
          impulse: msg.impulse,
          x: msg.x,
          y: msg.y,
        });
      } else if (msg.type === 'finish_race') {
        this.broadcastServerMessage({
          type: 'player_finished',
          playerId: this.playerId || 'host',
          rank: msg.rank || 1,
          totalTime: msg.totalTime,
        });
      }
    } else {
      if (this.guestConn && this.guestConn.open) {
        this.guestConn.send(msg);
      }
    }
  }

  public joinLobby(name: string, carId: CarId): void {
    this.lastSessionName = name;
    this.lastSessionCarId = carId;

    if (this.isHost && this.localPlayerInfo) {
      this.localPlayerInfo.name = name;
      this.localPlayerInfo.carId = carId;
      this.triggerLobbyUpdate();
    } else {
      this.send({ type: 'join_lobby', name, carId, roomCode: this.roomCode || undefined });
    }
  }

  public setReady(ready: boolean, carId: CarId): void {
    this.lastSessionCarId = carId;

    if (this.isHost && this.localPlayerInfo) {
      this.localPlayerInfo.ready = ready;
      this.localPlayerInfo.carId = carId;
      this.triggerLobbyUpdate();
    } else {
      this.send({ type: 'set_ready', ready, carId });
    }
  }

  public startRace(trackId?: string): void {
    if (this.isHost) {
      const players = this.getAllNetworkPlayers();
      const startMsg: ServerMessage = {
        type: 'race_start',
        players,
        totalLaps: 3,
        trackId,
        startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      };
      this.broadcastServerMessage(startMsg);
      this.startHostSyncLoop();

      if (this.onRaceStartCallback) {
        this.onRaceStartCallback(players, 3, trackId);
      }
    } else {
      this.send({ type: 'start_race', trackId });
    }
  }

  public sendState(state: VehicleState, lap: number, progress: number, nitroActive: boolean, steer: number): void {
    this.send({
      type: 'send_state',
      state,
      lap,
      progress,
      nitroActive,
      steer,
      timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    });
  }

  public sendCollision(targetId: string, impulse: number, x?: number, y?: number): void {
    this.send({ type: 'collision_event', targetId, impulse, x, y });
  }

  public sendFinish(totalTime: number, bestLapTime: number | null, rank?: number): void {
    this.send({ type: 'finish_race', totalTime, bestLapTime, rank });
  }

  private cleanupTransports(): void {
    this.stopHostSyncLoop();

    if (this.guestConn) {
      try {
        this.guestConn.close();
      } catch {}
      this.guestConn = null;
    }

    for (const p of this.hostPeers.values()) {
      try {
        p.conn.close();
      } catch {}
    }
    this.hostPeers.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.interpolator.clear();
  }

  public disconnect(): void {
    this.isManualDisconnect = true;
    this.clearReconnectTimer();
    this.cleanupTransports();

    this.setConnectionStatus('disconnected');
    this.playerId = null;
    this.isHost = false;
    this.roomCode = null;
    this.localPlayerInfo = null;
    this.localLatestState = undefined;
    this.setStatus('Desconectado');
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
