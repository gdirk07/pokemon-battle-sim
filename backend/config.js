const int = (v, d) => (v === undefined || v === '' ? d : Number(v));

const MODES = ['manual', 'streamerbot'];
const MODE = process.env.PB_MODE || 'manual';
if (!MODES.includes(MODE)) {
    throw new Error(`Invalid PB_MODE "${MODE}". Use one of: ${MODES.join(', ')}`);
}

module.exports = {
    PORT: int(process.env.PORT, 3000),
    FORMAT: 'gen9randombattle',
    MODE,

    // Time the betting window stays open. null = no automatic close (manual mode: operator clicks Start)
    BETTING_MS: MODE === 'manual' ? null : int(process.env.BETTING_MS, 30000),

    // Must match the per-entry delay used by the overlay's playback (frontend TURN_ENTRY_DELAY_MS).
    // Only used to size the ack watchdog, NOT to pace anything.
    TURN_ENTRY_MS: int(process.env.TURN_ENTRY_MS, 1200),
    // Extra time on top of (entries * TURN_ENTRY_MS) before the overlay is considered stuck
    ACK_SLACK_MS: int(process.env.ACK_SLACK_MS, 20000),

    // null = wait for PB_NEXT_TURN / manual "next". A number = auto-advance that long after each ack.
    AUTO_ADVANCE_MS: process.env.AUTO_ADVANCE_MS === undefined ? null : int(process.env.AUTO_ADVANCE_MS, null),

    STREAMERBOT: {
        url: process.env.STREAMERBOT_URL || 'ws://localhost:9000',
        password: process.env.STREAMERBOT_PASSWORD || null,
        retryMs: int(process.env.STREAMERBOT_RETRY_MS, 3000),
    },
};
