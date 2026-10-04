/**
 * Minimal key/value store used to persist processed forecasts between
 * requests, deployments and serverless instances. Values are opaque strings.
 */
export interface CacheStore {
  readonly name: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}
