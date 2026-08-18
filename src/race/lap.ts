export interface LapTrackerState {
  currentLap: number;
  totalLaps: number;
  lapProgress: number;
  totalProgress: number;
  currentLapTime: number;
  bestLapTime: number | null;
  lapTimes: number[];
  isFinished: boolean;
  totalRaceTime: number;
  lastProgress: number;
  passedCheckpoints: {
    cp25: boolean;
    cp50: boolean;
    cp75: boolean;
  };
}

export function createLapTracker(totalLaps: number = 3): LapTrackerState {
  return {
    currentLap: 1,
    totalLaps,
    lapProgress: 0,
    totalProgress: 0,
    currentLapTime: 0,
    bestLapTime: null,
    lapTimes: [],
    isFinished: false,
    totalRaceTime: 0,
    lastProgress: 0,
    passedCheckpoints: {
      cp25: false,
      cp50: false,
      cp75: false,
    },
  };
}

export function updateLapTracker(
  tracker: LapTrackerState,
  currentTrackProgress: number,
  dt: number
): LapTrackerState {
  if (tracker.isFinished) {
    return tracker;
  }

  const currentLapTime = tracker.currentLapTime + dt;
  const totalRaceTime = tracker.totalRaceTime + dt;

  const passedCheckpoints = { ...tracker.passedCheckpoints };

  // Validação sequencial de checkpoints
  if (currentTrackProgress >= 0.2 && currentTrackProgress <= 0.45) {
    passedCheckpoints.cp25 = true;
  }
  if (passedCheckpoints.cp25 && currentTrackProgress >= 0.45 && currentTrackProgress <= 0.75) {
    passedCheckpoints.cp50 = true;
  }
  if (passedCheckpoints.cp50 && currentTrackProgress >= 0.7 && currentTrackProgress <= 0.98) {
    passedCheckpoints.cp75 = true;
  }

  let currentLap = tracker.currentLap;
  let bestLapTime = tracker.bestLapTime;
  const lapTimes = [...tracker.lapTimes];
  let isFinished: boolean = tracker.isFinished;
  let nextLapTime = currentLapTime;

  // Cruzou a linha de chegada de forma válida
  if (
    tracker.lastProgress > 0.8 &&
    currentTrackProgress < 0.2 &&
    passedCheckpoints.cp25 &&
    passedCheckpoints.cp50 &&
    passedCheckpoints.cp75
  ) {
    lapTimes.push(currentLapTime);

    if (bestLapTime === null || currentLapTime < bestLapTime) {
      bestLapTime = currentLapTime;
    }

    if (currentLap >= tracker.totalLaps) {
      isFinished = true;
    } else {
      currentLap += 1;
      nextLapTime = 0;
      passedCheckpoints.cp25 = false;
      passedCheckpoints.cp50 = false;
      passedCheckpoints.cp75 = false;
    }
  }

  const totalProgress = isFinished
    ? tracker.totalLaps
    : Math.max(0, currentLap - 1 + currentTrackProgress);

  return {
    currentLap,
    totalLaps: tracker.totalLaps,
    lapProgress: currentTrackProgress,
    totalProgress,
    currentLapTime: nextLapTime,
    bestLapTime,
    lapTimes,
    isFinished,
    totalRaceTime,
    lastProgress: currentTrackProgress,
    passedCheckpoints,
  };
}
