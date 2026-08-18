import type { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, NetworkPlayerInfo, NetworkPlayerState, ServerMessage } from './protocol';

interface ConnectedClient {
  ws: WebSocket;
  info: NetworkPlayerInfo;
  latestState?: NetworkPlayerState;
}

export function topGearMultiplayerPlugin(): Plugin {
  return {
    name: 'top-gear-multiplayer-plugin',
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) return;

      const wss = new WebSocketServer({ noServer: true });
      const clients = new Map<string, ConnectedClient>();
      let playerCounter = 0;
      let isRacing = false;

      server.httpServer.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        if (url.pathname === '/ws') {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      function broadcast(msg: ServerMessage, excludeId?: string): void {
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

      wss.on('connection', (ws) => {
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
            const msg: ClientMessage = JSON.parse(data.toString());

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
                timestamp: performance.now(),
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
            console.error('[Multiplayer Server Error]', e);
          }
        });

        ws.on('close', () => {
          clients.delete(playerId);
          if (clients.size === 0) {
            isRacing = false;
          } else if (client.info.isHost) {
            // Passa a liderança para o próximo
            const nextClient = clients.values().next().value;
            if (nextClient) {
              nextClient.info.isHost = true;
            }
          }
          broadcast({ type: 'player_disconnected', playerId });
          sendLobbyUpdate();
        });
      });

      console.log('🏎️ [Top Gear LAN Server] WebSocket ativo em ws://<LAN-IP>:5173/ws');
    },
  };
}
