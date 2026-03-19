const WebSocket = require('ws');

let wss

function initSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('Overlay connected');
  });
}

function broadcast(data) {
  if (!wss) return;

  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

module.exports = { initSocket, broadcast };