export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitterMs: number;
  maxRetries: number;
}

export const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  factor: 2.0,
  jitterMs: 300,
  maxRetries: 5,
};

export class ExponentialBackoff {
  private config: BackoffConfig;
  private currentAttempt: number = 0;

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_BACKOFF_CONFIG, ...config };
  }

  /**
   * Retorna o atraso em milissegundos para a tentativa especificada (ou atual)
   */
  public getDelay(attempt: number = this.currentAttempt): number {
    const rawDelay = this.config.initialDelayMs * Math.pow(this.config.factor, Math.max(0, attempt));
    const cappedDelay = Math.min(rawDelay, this.config.maxDelayMs);
    const jitter = Math.random() * this.config.jitterMs;
    return Math.round(cappedDelay + jitter);
  }

  /**
   * Verifica se ainda é possível tentar reconectar
   */
  public canRetry(attempt: number = this.currentAttempt): boolean {
    return attempt < this.config.maxRetries;
  }

  public nextAttempt(): number {
    this.currentAttempt++;
    return this.currentAttempt;
  }

  public get attempt(): number {
    return this.currentAttempt;
  }

  public get maxRetries(): number {
    return this.config.maxRetries;
  }

  public reset(): void {
    this.currentAttempt = 0;
  }
}
