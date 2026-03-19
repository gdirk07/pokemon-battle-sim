const express = require('express');
const http = require('http');
const cors = require('cors');

const config = require('./config');
const api = require('./server/api');
const { initSocket } = require('./server/socket');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', api);

const server = http.createServer(app);
initSocket(server);

const PORT = config.PORT;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});