const path = require('path');
const express = require('express');
const http = require('http');

const config = require('./config');
const createApi = require('./server/api');
const hub = require('./server/socket');
const { BattleFlow } = require('./battle/BattleFlow');
const { StreamerBotClient, NullStreamerBot } = require('./integrations/StreamerBotClient');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const streamerBot = config.MODE === 'streamerbot'
    ? new StreamerBotClient(config.STREAMERBOT)
    : new NullStreamerBot();

const battleFlow = new BattleFlow({ hub, streamerBot, config }).attach();
app.use('/api', createApi(battleFlow));

const server = http.createServer(app);
hub.attach(server);

server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT} (mode: ${config.MODE})`);
    streamerBot.connect();
});

let shuttingDown = false;
function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    streamerBot.close();
    hub.close();
    server.closeAllConnections?.();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
// Launched with an IPC channel (the e2e harness): exit when the parent goes away, even if it was killed hard,
// so the port never stays locked by an orphaned server.
if (process.send) process.on('disconnect', shutdown);
