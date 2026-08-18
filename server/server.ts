import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface NetworkPlayerInfo {
  id: string;
  name: string;
  carId: string;
  ready: boolean;
  isHost: boolean;
  slot: number;
}

interface NetworkPlayerState {
  id: string;
  state: any;
  lap: number;
  progress: number;
  nitroActive: boolean;
  steer: number;
  timestamp: number;
}

interface ConnectedClient {
  ws: WebSocket;
  info: NetworkPlayerInfo;
  latestState?: NetworkPlayerState;
}

const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'Top Gear: Legado Multiplayer Relay',
      time: new Date().toISOString(),
      activeConnections: clients.size,
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map<string, ConnectedClient>();
let playerCounter = 0;
let isRacing = false;

function broadcast(msg: any, excludeId?: string): void {
  const payload = JSON.stringify(msg);
  for (const [id, client] of clients) {
    if (excludeId && id === excludeId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function sendLobbyUpdate(): void {
  const playerList: NetworkPlayerInfo[] = Array.from(clients.values()).map((c) => c.info);
  const canStart = playerList.length >= 2 && playerList.every((p) => p.ready);
  broadcast({
    type: 'lobby_update',
    players: playerList,
    canStart,
  });
}

// Loop de sincronização em tempo real (30 Hz)
setInterval(() => {
  if (!isRacing || clients.size === 0) return;

  const states: NetworkPlayerState[] = [];
  for (const client of clients.values()) {
    if (client.latestState) {
      states.push(client.latestState);
    }
  }

  if (states.length > 0) {
    broadcast({
      type: 'world_sync',
      players: states,
    });
  }
}, 1000 / 30);

wss.on('connection', (ws: WebSocket) => {
  playerCounter++;
  const playerId = `player_${playerCounter}_${Math.random().toString(36).substring(2, 6)}`;
  const isHost = clients.size === 0;

  const defaultInfo: NetworkPlayerInfo = {
    id: playerId,
    name: isHost ? 'Jogador 1 (Host)' : `Jogador ${clients.size + 1}`,
    carId: 'cannibal',
    ready: false,
    isHost,
    slot: clients.size,
  };

  const client: ConnectedClient = {
    ws,
    info: defaultInfo,
  };
  clients.set(playerId, client);

  // Boas-vindas
  ws.send(JSON.stringify({ type: 'welcome', playerId, isHost }));
  sendLobbyUpdate();

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'join_lobby') {
        client.info.name = msg.name || client.info.name;
        client.info.carId = msg.carId || client.info.carId;
        sendLobbyUpdate();
      } else if (msg.type === 'set_ready') {
        client.info.ready = msg.ready;
        client.info.carId = msg.carId;
        sendLobbyUpdate();
      } else if (msg.type === 'start_race') {
        if (client.info.isHost) {
          isRacing = true;
          const playerList = Array.from(clients.values()).map((c) => c.info);
          broadcast({
            type: 'race_start',
            players: playerList,
            totalLaps: 3,
          });
        }
      } else if (msg.type === 'send_state') {
        client.latestState = {
          id: playerId,
          state: msg.state,
          lap: msg.lap,
          progress: msg.progress,
          nitroActive: msg.nitroActive,
          steer: msg.steer,
          timestamp: Date.now(),
        };
      } else if (msg.type === 'collision_event') {
        broadcast(
          {
            type: 'remote_collision',
            sourceId: playerId,
            targetId: msg.targetId,
            impulse: msg.impulse,
          },
          playerId
        );
      }
    } catch (e) {
      console.error('[Multiplayer Relay Message Error]', e);
    }
  });

  ws.on('close', () => {
    clients.delete(playerId);
    if (clients.size === 0) {
      isRacing = false;
    } else if (client.info.isHost) {
      const nextClient = clients.values().next().value;
      if (nextClient) {
        nextClient.info.isHost = true;
      }
    }
    broadcast({ type: 'player_disconnected', playerId });
    sendLobbyUpdate();
  });
});

server.listen(PORT, () => {
  console.log(`🏎️ [Top Gear Relay Server] Rodando na porta ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🩺 Health check: http://localhost:${PORT}/health`);
});
