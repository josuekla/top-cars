export interface TimeAttackRecord {
  trackId: string;
  carId: string;
  bestLapTime: number;
  date: string;
}

export class TimeAttackManager {
  private readonly storageKey = 'topgear_timeattack_records';
  private inMemoryRecords: Record<string, number> = {};

  constructor() {
    this.loadRecords();
  }

  private loadRecords(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.inMemoryRecords = JSON.parse(raw);
        }
      } catch {
        // Fallback silencioso
      }
    }
  }

  public getBestLap(trackId: string, carId: string): number | null {
    const key = `${trackId}:${carId}`;
    return this.inMemoryRecords[key] ?? null;
  }

  public saveLapTime(trackId: string, carId: string, lapTime: number): boolean {
    const key = `${trackId}:${carId}`;
    const currentBest = this.inMemoryRecords[key];

    if (currentBest === undefined || lapTime < currentBest) {
      this.inMemoryRecords[key] = lapTime;
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.inMemoryRecords));
        } catch {
          // Fallback
        }
      }
      return true; // Novo recorde estabelecido!
    }

    return false;
  }

  public clearRecords(): void {
    this.inMemoryRecords = {};
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }
}
