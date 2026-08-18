import { Peer, type DataConnection } from 'peerjs';
import type { CarId, VehicleState } from '../core';
import type { ClientMessage, NetworkPlayerInfo, NetworkPlayerState, ServerMessage } from './protocol';

export type MultiplayerTransport = 'webrtc' | 'websocket';

export interface ConnectedPeer {
  conn: DataConnection;
  info: NetworkPlayerInfo;
  latestState?: NetworkPlayerState;
}

const PEER_PREFIX = 'tglegado-';
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export class MultiplayerClient {
  public transport: MultiplayerTransport = 'webrtc';
  public playerId: string | null = null;
  public isHost: boolean = false;
  public isConnected: boolean = false;
  public roomCode: string | null = null;
  public statusMessage: string = 'Desconectado';

  // Callbacks de Eventos do Jogo
  public onLobbyUpdateCallback?: (players: NetworkPlayerInfo[], canStart: boolean) => void;
  public onRaceStartCallback?: (players: NetworkPlayerInfo[], totalLaps: number) => void;
  public onWorldSyncCallback?: (players: NetworkPlayerState[]) => void;
  public onRemoteCollisionCallback?: (sourceId: string, targetId: string, impulse: number) => void;
  public onStatusChangeCallback?: (msg: string, isError: boolean) => void;

  // Estados Internos do WebRTC (PeerJS)
  private peer: Peer | null = null;
  private guestConn: DataConnection | null = null; // Conexão com o Host quando este cliente é Guest
  private hostPeers: Map<string, ConnectedPeer> = new Map(); // Peers conectados quando este cliente é Host
  private localPlayerInfo: NetworkPlayerInfo | null = null;
  private localLatestState?: NetworkPlayerState;
  private hostSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isRacing: boolean = false;

  // Estados Internos do WebSocket
  private ws: WebSocket | null = null;

  constructor() {}

  private setStatus(msg: string, isError: boolean = false): void {
    this.statusMessage = msg;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(msg, isError);
    }
  }

  // ==========================================
  // MODO 1: WebRTC P2P (PeerJS - 100% Serverless)
  // ==========================================

  /**
   * Cria uma sala WebRTC e atua como Host (Serverless Hub).
   * @param roomCode Código da sala (ex: 'TURBO7'). Se não fornecido, gera um código aleatório.
   */
  public createP2PRoom(name: string, carId: CarId, customRoomCode?: string): Promise<string> {
    this.disconnect();
    this.transport = 'webrtc';
    this.isHost = true;
    this.setStatus('Conectando ao broker de sinalização WebRTC...');

    return new Promise((resolve, reject) => {
      const code = (customRoomCode || this.generateRoomCode()).trim().toUpperCase();
      this.roomCode = code;
      const peerId = `${PEER_PREFIX}${code.toLowerCase()}`;

      try {
        this.peer = new Peer(peerId, {
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
          },
        });

        this.peer.on('open', (_id) => {
          this.isConnected = true;
          this.playerId = `host_${Math.random().toString(36).substring(2, 7)}`;

          this.localPlayerInfo = {
            id: this.playerId,
            name: name || 'Piloto 1 (Host)',
            carId,
            ready: true,
            isHost: true,
            slot: 0,
          };

          this.setStatus(`Sala online criada: ${code} (Aguardando amigos)`);
          this.triggerLobbyUpdate();
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingPeerConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          console.error('[WebRTC Host Peer Error]', err);
          const errorMsg = err.type === 'unavailable-id'
            ? `O código ${code} já está em uso. Tente outro código.`
            : `Erro no WebRTC: ${err.message || err.type}`;
          this.setStatus(errorMsg, true);
          this.disconnect();
          reject(new Error(errorMsg));
        });

        this.peer.on('disconnected', () => {
          this.setStatus('Conexão com o broker reiniciando...');
          this.peer?.reconnect();
        });
      } catch (err) {
        this.setStatus('Falha ao inicializar WebRTC Peer.', true);
        reject(err);
      }
    });
  }

  /**
   * Conecta a uma sala WebRTC existente como Convidado (Guest).
   */
  public joinP2PRoom(roomCode: string, name: string, carId: CarId): Promise<void> {
    this.disconnect();
    this.transport = 'webrtc';
    this.isHost = false;
    const cleanCode = roomCode.trim().toUpperCase();
    this.roomCode = cleanCode;
    const hostPeerId = `${PEER_PREFIX}${cleanCode.toLowerCase()}`;

    this.setStatus(`Conectando à sala ${cleanCode}...`);

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          config: {
            iceServers: DEFAULT_ICE_SERVERS,
          },
        });

        const timeout = setTimeout(() => {
          this.setStatus(`Tempo limite excedido ao buscar sala ${cleanCode}.`, true);
          this.disconnect();
          reject(new Error('Timeout ao conectar à sala'));
        }, 12000);

        this.peer.on('open', () => {
          const conn = this.peer!.connect(hostPeerId, {
            reliable: true,
          });

          this.guestConn = conn;

          conn.on('open', () => {
            clearTimeout(timeout);
            this.isConnected = true;
            this.setStatus(`Conectado à sala ${cleanCode} via WebRTC P2P!`);
            this.send({ type: 'join_lobby', name, carId });
            resolve();
          });

          conn.on('data', (raw) => {
            this.handleServerMessage(raw);
          });

          conn.on('close', () => {
            this.setStatus('Conexão com o Host encerrada.', true);
            this.isConnected = false;
            this.playerId = null;
          });

          conn.on('error', (err) => {
            clearTimeout(timeout);
            console.error('[WebRTC Guest Connection Error]', err);
            this.setStatus('Erro ao comunicar com o Host da sala.', true);
            reject(err);
          });
        });

        this.peer.on('error', (err: any) => {
          clearTimeout(timeout);
          console.error('[WebRTC Guest Peer Error]', err);
          const errorMsg = err.type === 'peer-unavailable'
            ? `Sala "${cleanCode}" não encontrada. Verifique o código com o Host.`
            : `Erro WebRTC: ${err.message || err.type}`;
          this.setStatus(errorMsg, true);
          this.disconnect();
          reject(new Error(errorMsg));
        });
      } catch (err) {
        this.setStatus('Falha ao iniciar cliente WebRTC.', true);
        reject(err);
      }
    });
  }

  /**
   * Manipula novas conexões recebidas pelo Host.
   */
  private handleIncomingPeerConnection(conn: DataConnection): void {
    const peerPlayerId = `player_${this.hostPeers.size + 2}_${Math.random().toString(36).substring(2, 6)}`;

    const peerInfo: NetworkPlayerInfo = {
      id: peerPlayerId,
      name: `Piloto ${this.hostPeers.size + 2}`,
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

    conn.on('open', () => {
      // Envia mensagem de boas-vindas para o guest
      conn.send({
        type: 'welcome',
        playerId: peerPlayerId,
        isHost: false,
      } as ServerMessage);

      this.triggerLobbyUpdate();
      this.setStatus(`${peerInfo.name} entrou na sala!`);
    });

    conn.on('data', (raw) => {
      try {
        const msg: ClientMessage = typeof raw === 'string' ? JSON.parse(raw) : (raw as ClientMessage);

        if (msg.type === 'join_lobby') {
          connectedPeer.info.name = msg.name || connectedPeer.info.name;
          connectedPeer.info.carId = msg.carId || connectedPeer.info.carId;
          this.triggerLobbyUpdate();
        } else if (msg.type === 'set_ready') {
          connectedPeer.info.ready = msg.ready;
          connectedPeer.info.carId = msg.carId;
          this.triggerLobbyUpdate();
        } else if (msg.type === 'send_state') {
          connectedPeer.latestState = {
            id: peerPlayerId,
            state: msg.state,
            lap: msg.lap,
            progress: msg.progress,
            nitroActive: msg.nitroActive,
            steer: msg.steer,
            timestamp: performance.now(),
          };
        } else if (msg.type === 'collision_event') {
          // Repassa colisão para os demais
          this.broadcastServerMessage(
            {
              type: 'remote_collision',
              sourceId: peerPlayerId,
              targetId: msg.targetId,
              impulse: msg.impulse,
            },
            peerPlayerId
          );
          if (this.onRemoteCollisionCallback) {
            this.onRemoteCollisionCallback(peerPlayerId, msg.targetId, msg.impulse);
          }
        }
      } catch (err) {
        console.error('[Host Error Processing Guest Message]', err);
      }
    });

    conn.on('close', () => {
      this.hostPeers.delete(peerPlayerId);
      this.broadcastServerMessage({ type: 'player_disconnected', playerId: peerPlayerId });
      this.triggerLobbyUpdate();
      this.setStatus(`Um piloto saiu da sala.`);
    });
  }

  /**
   * Retorna a lista completa de jogadores (Host + Guests).
   */
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

  /**
   * Dispara atualização do Lobby para todos os participantes quando este cliente é Host.
   */
  private triggerLobbyUpdate(): void {
    if (!this.isHost) return;
    const players = this.getAllNetworkPlayers();
    const canStart = players.length >= 2 && players.every((p) => p.ready);

    const updateMsg: ServerMessage = {
      type: 'lobby_update',
      players,
      canStart,
    };

    this.broadcastServerMessage(updateMsg);

    if (this.onLobbyUpdateCallback) {
      this.onLobbyUpdateCallback(players, canStart);
    }
  }

  /**
   * Envia uma mensagem do Host para todos os Guests conectados.
   */
  private broadcastServerMessage(msg: ServerMessage, excludeId?: string): void {
    const payload = msg;
    for (const [id, peer] of this.hostPeers) {
      if (excludeId && id === excludeId) continue;
      try {
        if (peer.conn.open) {
          peer.conn.send(payload);
        }
      } catch (e) {
        console.error(`[Broadcast Error to ${id}]`, e);
      }
    }
  }

  /**
   * Inicia o loop de sincronização física 60 Hz / 30 Hz do Host.
   */
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

  // ==========================================
  // MODO 2: WebSocket Relay (Render / Node.js / Localhost)
  // ==========================================

  public connect(customUrl?: string): Promise<void> {
    return this.connectWebSocket(customUrl);
  }

  public connectWebSocket(customUrl?: string): Promise<void> {
    this.disconnect();
    this.transport = 'websocket';
    this.setStatus('Conectando ao servidor WebSocket...');

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = customUrl || `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.setStatus(`Conectado ao servidor WebSocket (${wsUrl})`);
          resolve();
        };

        this.ws.onerror = (err) => {
          this.isConnected = false;
          this.setStatus('Erro ao conectar ao servidor WebSocket.', true);
          reject(err);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.playerId = null;
          this.setStatus('Servidor WebSocket desconectado.', true);
        };

        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };
      } catch (e) {
        this.setStatus('Falha ao instanciar WebSocket.', true);
        reject(e);
      }
    });
  }

  // ==========================================
  // Processamento Unificado de Mensagens
  // ==========================================

  private handleServerMessage(raw: unknown): void {
    try {
      const msg: ServerMessage = typeof raw === 'string' ? JSON.parse(raw) : (raw as ServerMessage);

      if (msg.type === 'welcome') {
        this.playerId = msg.playerId;
        this.isHost = msg.isHost;
      } else if (msg.type === 'lobby_update') {
        if (this.onLobbyUpdateCallback) {
          this.onLobbyUpdateCallback(msg.players, msg.canStart);
        }
      } else if (msg.type === 'race_start') {
        if (this.onRaceStartCallback) {
          this.onRaceStartCallback(msg.players, msg.totalLaps);
        }
      } else if (msg.type === 'world_sync') {
        if (this.onWorldSyncCallback) {
          this.onWorldSyncCallback(msg.players);
        }
      } else if (msg.type === 'remote_collision') {
        if (this.onRemoteCollisionCallback) {
          this.onRemoteCollisionCallback(msg.sourceId, msg.targetId, msg.impulse);
        }
      }
    } catch (e) {
      console.error('[Multiplayer Client Message Parse Error]', e);
    }
  }

  // ==========================================
  // API Pública do Jogo
  // ==========================================

  public send(msg: ClientMessage): void {
    if (this.transport === 'websocket') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
      return;
    }

    // WebRTC Mode
    if (this.isHost) {
      // Se sou o Host, processo internamente minhas próprias ações de piloto
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
          timestamp: performance.now(),
        };
      } else if (msg.type === 'collision_event') {
        this.broadcastServerMessage({
          type: 'remote_collision',
          sourceId: this.playerId || 'host',
          targetId: msg.targetId,
          impulse: msg.impulse,
        });
      }
    } else {
      // Se sou Guest, envio para o Host via DataChannel
      if (this.guestConn && this.guestConn.open) {
        this.guestConn.send(msg);
      }
    }
  }

  public joinLobby(name: string, carId: CarId): void {
    if (this.isHost && this.localPlayerInfo) {
      this.localPlayerInfo.name = name;
      this.localPlayerInfo.carId = carId;
      this.triggerLobbyUpdate();
    } else {
      this.send({ type: 'join_lobby', name, carId });
    }
  }

  public setReady(ready: boolean, carId: CarId): void {
    if (this.isHost && this.localPlayerInfo) {
      this.localPlayerInfo.ready = ready;
      this.localPlayerInfo.carId = carId;
      this.triggerLobbyUpdate();
    } else {
      this.send({ type: 'set_ready', ready, carId });
    }
  }

  public startRace(): void {
    if (this.isHost) {
      const players = this.getAllNetworkPlayers();
      const startMsg: ServerMessage = {
        type: 'race_start',
        players,
        totalLaps: 3,
      };
      this.broadcastServerMessage(startMsg);
      this.startHostSyncLoop();

      if (this.onRaceStartCallback) {
        this.onRaceStartCallback(players, 3);
      }
    } else {
      this.send({ type: 'start_race' });
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
    });
  }

  public sendCollision(targetId: string, impulse: number): void {
    this.send({ type: 'collision_event', targetId, impulse });
  }

  public disconnect(): void {
    this.stopHostSyncLoop();

    // Fecha WebRTC
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

    // Fecha WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.isConnected = false;
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
