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
