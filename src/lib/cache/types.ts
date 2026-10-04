/**
 * Minimal key/value store used to persist processed forecasts between
 * requests, deployments and serverless instances. Values are opaque strings.
 */
export interface CacheStore {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /**
   * Try to take a short-lived exclusive lock. Returns false if another
   * process or instance holds it. Locks expire after `ttlSeconds` so a
   * crashed holder can never block refreshes for long.
   */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}
