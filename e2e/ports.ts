// Each worker gets its own backend + fake Streamer.bot at BASE + workerIndex.
// Kept away from 3000 / 9000 so a dev server or a real Streamer.bot can stay running.
export const APP_PORT = 3100;
export const SB_PORT = 9100;

// Test-speed timings. Backend TURN_ENTRY_MS must match the overlay's per-entry delay (it sizes the ack watchdog).
export const TEST_BETTING_MS = 3000;
export const TEST_TURN_ENTRY_MS = 50;
