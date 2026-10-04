import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CacheStore } from "./types";

/**
 * Filesystem store for self-hosted / Docker deployments (mount the directory
 * as a volume to keep forecasts across restarts). On Vercel it defaults to
 * /tmp, which persists for the lifetime of a warm function instance.
 */
export class FileStore implements CacheStore {
  readonly name = "file";

  constructor(private readonly directory: string) {}

  private filePath(key: string) {
    return path.join(this.directory, `${key.replace(/[^a-z0-9_-]/gi, "_")}.cache`);
  }

  async get(key: string) {
    try {
      return await readFile(this.filePath(key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async set(key: string, value: string) {
    await mkdir(this.directory, { recursive: true });
    const target = this.filePath(key);
    // Write-then-rename so readers never see a half-written file.
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temp, value, "utf8");
    await rename(temp, target);
  }
}
