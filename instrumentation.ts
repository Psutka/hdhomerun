export async function register() {
  // Only run in the Node.js runtime (not edge), and only once per process
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./lib/db");
    getDb(); // create DB file + schema on first run
    const { startSyncScheduler, startGuideScheduler } = await import("./lib/scheduler");
    startSyncScheduler();
    startGuideScheduler();
  }
}
