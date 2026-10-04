/**
 * Runs once when the server starts. In production, refuse to start with an
 * unusable data-provider configuration rather than serving a broken or
 * silently-degraded forecast. (Builds are checked in next.config.ts.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { configurationErrors } = await import("./lib/startup-check");
  const errors = configurationErrors();
  if (errors.length > 0) {
    console.error(`[startup] Refusing to start — invalid configuration:\n  - ${errors.join("\n  - ")}`);
    process.exit(1);
  }
}
