// Pipeline configuration constants.

// Watcher cadence. This is a CONFIG VALUE, not the logic — short for the demo so
// the scheduled function visibly runs against the LIVE APIs on stage. In a real
// deployment this would be daily/weekly. (See docs/WATCHER.md.)
export const WATCH_CRON = "*/2 * * * *"; // every 2 minutes
export const WATCH_CRON_HUMAN = "every 2 minutes";

export const BRIEF_URL_BASE = "/brief";

// Realtime channel + topic (the seam with Person B's subscription hook).
export const channelName = (runId: string) => `vus-run-${runId}`;
export const REALTIME_TOPIC = "events";
