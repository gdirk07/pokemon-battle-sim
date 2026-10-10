const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, 'unknown-events.log');

function logUnknownEvent(raw) {
    const line = `${new Date().toISOString()} | ${raw}\n`;
    fs.appendFileSync(LOG_PATH, line);
}

module.exports = { logUnknownEvent };