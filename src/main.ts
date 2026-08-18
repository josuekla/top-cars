import { buildTrack, DEFAULT_TRACK_DEFINITION, getTrackDefinition, type Track, type TrackDefinition } from './track';
import { RaceManager, type RaceMode } from './race';
import { TimeAttackManager } from './race/timeattack';
import { HUD, InputManager, Minimap, ResultsScreen } from './gameplay';
import { AuthGate, MenuSystem, PauseMenu, type MenuStartOptions } from './ui';
import { soundSystem } from './audio';
import {
  ChaseCamera,
  createCarMesh,
  createPitMeshInstance,
  createScene,
  createTrackMesh,
  GameLoop,
  ParticleSystem,
  SkidmarkManager,
  updateCarMesh,
  updatePitGlow,
  updateSceneTheme,
  type CarMeshInstance,
  type PitMeshInstance,
} from './render';

const app: HTMLDivElement = document.querySelector<HTMLDivElement>('#app')!;
if (!app) {
  throw new Error('Elemento #app não encontrado');
}

// 1. Inicializa Cena 3D Three.js
const sceneCtx = createScene(app);
const { scene, renderer } = sceneCtx;

// 2. Estado de Pista Atual, Pit Lane, Partículas e Marcas de Pneu
let currentTrackDef: TrackDefinition = DEFAULT_TRACK_DEFINITION;
let track: Track = buildTrack(currentTrackDef);
let trackMesh = createTrackMesh(track);
let pitInstance: PitMeshInstance = createPitMeshInstance(track);
const particleSystem = new ParticleSystem();
const skidmarkManager = new SkidmarkManager();

scene.add(trackMesh);
scene.add(pitInstance.group);
scene.add(particleSystem.group);
scene.add(skidmarkManager.mesh);

// 3. Gerenciadores de Sessão
const timeAttackManager = new TimeAttackManager();
let raceManager = new RaceManager(track, {
  mode: 'race',
  totalLaps: 3,
  difficulty: 'pro',
  playerCarId: 'cannibal',
  aiCount: 3,
});

// 4. Câmera, HUD, Minimapa e Resultados
const chaseCamera = new ChaseCamera();
const hud = new HUD(app);
const resultsScreen = new ResultsScreen(app);
const minimapMountEl = (hud.overlay.querySelector<HTMLDivElement>('#hud-minimap-mount') as HTMLElement) ?? app;
let minimap: Minimap = new Minimap(
  minimapMountEl,
  track,
  140,
  100
);

// Instâncias visuais 3D para todos os pilotos (Jogador + IAs)
let carMeshMap = new Map<string, CarMeshInstance>();
let previousPlayerPositions: Map<string, { x: number; z: number }> = new Map();

function rebuildSceneTrack(newTrackDef: TrackDefinition): void {
  if (newTrackDef.id === currentTrackDef.id && track) return;

  currentTrackDef = newTrackDef;
  scene.remove(trackMesh);
  scene.remove(pitInstance.group);

  track = buildTrack(currentTrackDef);
  trackMesh = createTrackMesh(track);
  pitInstance = createPitMeshInstance(track);

  scene.add(trackMesh);
  scene.add(pitInstance.group);

  if (currentTrackDef.theme) {
    updateSceneTheme(sceneCtx, currentTrackDef.theme);
  }

  // Recria o minimapa com o novo circuito
  if (minimap) {
    minimap.destroy();
    const mount: HTMLElement = hud.overlay.querySelector<HTMLDivElement>('#hud-minimap-mount') ?? app;
    minimap = new Minimap(mount, track, 140, 100);
  }
}

function rebuildCarMeshes(): void {
  carMeshMap.forEach((inst) => scene.remove(inst.root));
  carMeshMap.clear();
  previousPlayerPositions.clear();

  for (const racer of raceManager.racers) {
    const meshInst = createCarMesh(racer.stats);
    scene.add(meshInst.root);
    carMeshMap.set(racer.id, meshInst);
    previousPlayerPositions.set(racer.id, { x: racer.state.x, z: racer.state.y });
  }
}

rebuildCarMeshes();


// Overlay de Contagem Regressiva (3-2-1-GO!)
const countdownEl = document.createElement('div');
countdownEl.id = 'race-countdown-overlay';
countdownEl.style.cssText = `
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: 'Courier New', monospace, sans-serif;
  font-size: 84px;
  font-weight: 900;
  color: #f1c40f;
  text-shadow: 0 0 25px rgba(241, 196, 15, 0.9), 4px 4px 0 #e74c3c;
  pointer-events: none;
  z-index: 500;
  display: none;
`;
app.appendChild(countdownEl);

let lastCountdownVal: string | null = null;
let isResultsShown = false;
let isGameActive = false;
let isPaused = false;
let wasInSlipstream = false;
let lastPlayerLap = 1;

// 5. Configuração do Menu de Pausa
const pauseMenu = new PauseMenu(app, {
  onResume: () => {
    isPaused = false;
    soundSystem.playBeep(660);
  },
  onRestart: () => {
    isPaused = false;
    startNewRace(currentStartOptions);
  },
  onMainMenu: () => {
    isPaused = false;
    showMenu();
  },
  onPause: () => {
    isPaused = true;
    soundSystem.updateEngine(0, raceManager.player.stats.topSpeed, false);
    soundSystem.updateSkid(0);
  },
});

// 6. Gerenciador de Entrada
const inputManager = new InputManager((code) => {
  if (code === 'KeyM') {
    soundSystem.toggleMute();
  }
  if (code === 'Escape') {
    if (isResultsShown) {
      showMenu();
    } else if (isGameActive) {
      pauseMenu.toggle();
    }
  } else if ((code === 'Space' || code === 'Enter') && isResultsShown) {
    startNewRace(currentStartOptions);
  }
});

// 7. Configuração do Menu Principal
let currentStartOptions: MenuStartOptions = {
  mode: 'race',
  carId: 'cannibal',
  trackId: 'las_vegas',
  difficulty: 'pro',
  trackDefinition: DEFAULT_TRACK_DEFINITION,
};

const menuSystem: MenuSystem = new MenuSystem(app, (options) => {
  currentStartOptions = options;
  startNewRace(options);
});

function startNewRace(options: MenuStartOptions): void {
  soundSystem.init();

  // Atualiza circuito se necessário
  const trackDef = options.trackDefinition ?? (options.trackId ? getTrackDefinition(options.trackId) : DEFAULT_TRACK_DEFINITION);
  rebuildSceneTrack(trackDef);

  // Inicia música da pista correspondente (MP3)
  if (trackDef.musicUrl) {
    soundSystem.playTrackMusic(trackDef.musicUrl);
  }

  if (options.mode === 'multiplayer' && options.multiplayerClient && options.networkPlayers) {
    const mpPlayers = options.networkPlayers.map((p, idx) => ({
      id: p.id,
      name: p.name,
      carId: p.carId,
      isLocal: p.id === options.multiplayerClient!.playerId,
      slot: idx,
    }));

    raceManager = new RaceManager(track, {
      mode: 'multiplayer',
      totalLaps: 3,
      difficulty: options.difficulty,
      playerCarId: options.carId,
      aiCount: 0,
      multiplayerPlayers: mpPlayers,
    });

    options.multiplayerClient.onRemoteCollisionCallback = (_sourceId, _targetId, impulse, x, y) => {
      raceManager.applyRemoteCollision(impulse);
      soundSystem.playCollision(impulse);
      const sparkX = x !== undefined ? x : raceManager.player.state.x;
      const sparkY = y !== undefined ? y : raceManager.player.state.y;
      particleSystem.emitSparks(sparkX, 0.45, sparkY, Math.min(18, Math.round(impulse * 6)));
    };

    options.multiplayerClient.onPlayerFinishedCallback = (playerId, rank, totalTime) => {
      raceManager.registerRemoteFinish(playerId, rank, totalTime);
    };
  } else {
    raceManager = new RaceManager(track, {
      mode: options.mode as RaceMode,
      totalLaps: 3,
      difficulty: options.difficulty,
      playerCarId: options.carId,
      aiCount: options.mode === 'timeattack' ? 0 : 3,
    });
  }

  rebuildCarMeshes();
  resultsScreen.hide();
  isResultsShown = false;
  isPaused = false;
  pauseMenu.hide();
  pauseMenu.showPauseButton();
  isGameActive = true;
  lastCountdownVal = null;
  wasInSlipstream = false;
  lastPlayerLap = 1;
}

function showMenu(): void {
  isGameActive = false;
  isPaused = false;
  pauseMenu.hide();
  pauseMenu.hidePauseButton();
  resultsScreen.hide();
  soundSystem.playMenuMusic();
  menuSystem.show();
}

// 8. Loop de Jogo Principal
const gameLoop = new GameLoop(
  // Atualização de Física (60 Hz)
  (fixedDt) => {
    if (!isGameActive || isPaused) return;

    const input = inputManager.getInput();
    const wasNitroActive = raceManager.player.nitroSystem.isActive;

    raceManager.update(input, fixedDt);

    // Atualização suave a 60 FPS dos oponentes remotos via Dead Reckoning + LERP
    if (currentStartOptions.mode === 'multiplayer' && currentStartOptions.multiplayerClient) {
      for (const racer of raceManager.racers) {
        if (!racer.isPlayer) {
          const interp = currentStartOptions.multiplayerClient.getInterpolatedState(racer.id);
          if (interp) {
            racer.state = interp.state;
            racer.lapTracker.currentLap = interp.lap;
            racer.lapTracker.lapProgress = interp.progress;
            racer.nitroSystem.timer = interp.nitroActive ? 1.0 : 0;
          }
        }
      }
    }

    // Envio de estado no modo multiplayer
    if (currentStartOptions.mode === 'multiplayer' && currentStartOptions.multiplayerClient) {
      currentStartOptions.multiplayerClient.sendState(
        raceManager.player.state,
        raceManager.player.lapTracker.currentLap,
        raceManager.player.lapTracker.lapProgress,
        raceManager.player.nitroSystem.isActive,
        input.steer
      );
    }

    // Efeito sonoro de nitro
    if (!wasNitroActive && raceManager.player.nitroSystem.isActive) {
      soundSystem.playNitro();
      soundSystem.playBackfire();
    }

    // Efeito sonoro e faíscas de colisão
    if (raceManager.lastCollisionImpulse > 0.3) {
      soundSystem.playCollision(raceManager.lastCollisionImpulse);
      particleSystem.emitSparks(
        raceManager.player.state.x,
        0.45,
        raceManager.player.state.y,
        Math.min(18, Math.round(raceManager.lastCollisionImpulse * 5))
      );

      // Notifica oponente remoto da colisão
      if (currentStartOptions.mode === 'multiplayer' && currentStartOptions.multiplayerClient) {
        const remoteOpponent = raceManager.racers.find((r) => !r.isPlayer);
        if (remoteOpponent) {
          currentStartOptions.multiplayerClient.sendCollision(
            remoteOpponent.id,
            raceManager.lastCollisionImpulse,
            raceManager.player.state.x,
            raceManager.player.state.y
          );
        }
      }
    }

    // Efeito sonoro de Vácuo (Slipstream)
    if (raceManager.isPlayerInSlipstream && !wasInSlipstream) {
      soundSystem.playSlipstream();
    }
    wasInSlipstream = raceManager.isPlayerInSlipstream;

    // Torcida comemora a cada nova volta
    if (raceManager.player.lapTracker.currentLap > lastPlayerLap) {
      lastPlayerLap = raceManager.player.lapTracker.currentLap;
      soundSystem.playCrowdCheer();
    }

    // Beeps de contagem regressiva
    const currentCd = raceManager.countdownDisplay;
    if (currentCd && currentCd !== lastCountdownVal) {
      lastCountdownVal = currentCd;
      countdownEl.textContent = currentCd;
      countdownEl.style.display = 'block';
      soundSystem.playCountdown(currentCd === 'GO!');
    } else if (!currentCd && countdownEl.style.display !== 'none') {
      countdownEl.style.display = 'none';
    }

    // Fim de prova do jogador
    if (raceManager.status === 'finished' && !isResultsShown) {
      isResultsShown = true;
      pauseMenu.hide();
      pauseMenu.hidePauseButton();
      soundSystem.playCrowdCheer();

      if (currentStartOptions.mode === 'multiplayer' && currentStartOptions.multiplayerClient) {
        currentStartOptions.multiplayerClient.sendFinish(
          raceManager.player.finishTime || raceManager.totalTime,
          raceManager.player.lapTracker.bestLapTime,
          raceManager.player.finishRank || 1
        );
      }

      if (raceManager.config.mode === 'timeattack' && raceManager.player.lapTracker.bestLapTime) {
        timeAttackManager.saveLapTime(
          track.definition.id,
          raceManager.player.carId,
          raceManager.player.lapTracker.bestLapTime
        );
      }

      resultsScreen.show(
        raceManager.getLeaderboard(),
        () => startNewRace(currentStartOptions),
        () => showMenu()
      );
    }
  },

  // Atualização Visual por Frame
  (frameDt) => {
    if (isGameActive && !isPaused) {
      // Atualiza malhas 3D de todos os carros e efeitos de pneu
      for (const racer of raceManager.racers) {
        const meshInst = carMeshMap.get(racer.id);
        if (meshInst) {
          const steer = racer.isPlayer ? inputManager.getInput().steer : 0;
          updateCarMesh(meshInst, racer.state, steer, frameDt);

          const prevPos = previousPlayerPositions.get(racer.id);
          const isDrifting = Math.abs(racer.state.lateralVelocity) > 3.0 && Math.abs(racer.state.speed) > 15;
          const isOffTrack = racer.state.surface === 'grass';

          // Emite fumaça de pneu / poeira
          if (isDrifting || isOffTrack) {
            particleSystem.emitTireSmoke(racer.state.x, 0.1, racer.state.y, isOffTrack);
          }

          // Adiciona marcas de pneu (Skidmarks) no asfalto durante drift
          if (isDrifting && prevPos && racer.state.surface === 'asphalt') {
            const nx = -Math.sin(racer.state.angle);
            const nz = Math.cos(racer.state.angle);
            skidmarkManager.addSkidmark(
              prevPos.x,
              prevPos.z,
              racer.state.x,
              racer.state.y,
              nx,
              nz,
              0.4
            );
          }

          if (prevPos) {
            prevPos.x = racer.state.x;
            prevPos.z = racer.state.y;
          }
        }
      }

      // Atualiza câmera no carro do jogador
      chaseCamera.update(raceManager.player.state, raceManager.player.stats, frameDt);

      // Atualiza Partículas e Minimapa
      particleSystem.update(frameDt);
      minimap.update(raceManager.racers);

      // Atualiza HUD
      hud.update({
        vehicleState: raceManager.player.state,
        carStats: raceManager.player.stats,
        fuel: raceManager.player.fuelSystem.getState(),
        nitro: raceManager.player.nitroSystem.getState(),
        lap: raceManager.player.lapTracker,
        position: raceManager.player.currentRank,
        totalRacers: raceManager.racers.length,
        surface: raceManager.player.state.surface,
        inSlipstream: raceManager.isPlayerInSlipstream,
      });

      // Atualiza sons de motor e derrapagem
      const isThrottle = inputManager.getInput().throttle > 0;
      soundSystem.updateEngine(
        raceManager.player.state.speed,
        raceManager.player.stats.topSpeed,
        isThrottle
      );
      soundSystem.updateSkid(raceManager.player.state.lateralVelocity);
    }

    updatePitGlow(pitInstance, performance.now() / 1000);
    renderer.render(scene, chaseCamera.camera);
  }
);

gameLoop.start();

// 9. Inicialização com Proteção de Senha (Vercel Gatekeeper)
if (AuthGate.isUnlocked()) {
  showMenu();
} else {
  new AuthGate(app, () => {
    showMenu();
  });
}