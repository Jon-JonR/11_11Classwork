const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const images = [];
const clients = new Map();
const clearVotes = new Set();

function quorum() {
  return Math.max(1, Math.ceil(clients.size / 2));
}

function sendPresence() {
  const message = JSON.stringify({ type: 'presence', connected: clients.size, votes: clearVotes.size, quorum: quorum() });
  clients.forEach((clientId, socket) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ ...JSON.parse(message), voted: clientId ? clearVotes.has(clientId) : false }));
  });
}

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  const filePath = path.join(__dirname, file);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
});
const wss = new WebSocket.Server({ server });
wss.on('connection', socket => {
  clients.set(socket, null);
  socket.send(JSON.stringify({ type: 'snapshot', items: images }));
  sendPresence();
  socket.on('message', raw => {
    try {
      const message = JSON.parse(raw);
      if (message.type === 'hello' && typeof message.clientId === 'string') {
        clients.set(socket, message.clientId);
        sendPresence();
        return;
      }
      if (message.type === 'clear-vote') {
        const clientId = clients.get(socket);
        if (!clientId) return;
        clearVotes.add(clientId);
        sendPresence();
        if (clearVotes.size >= quorum()) {
          images.length = 0;
          clearVotes.clear();
          clients.forEach((_, client) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'cleared' })); });
          sendPresence();
        }
        return;
      }
      if (message.type !== 'image' || !message.item?.src) return;
      images.push(message.item);
      clearVotes.clear();
      wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'image', item: message.item })); });
      sendPresence();
    } catch (_) {}
  });
  socket.on('close', () => {
    const clientId = clients.get(socket);
    clients.delete(socket);
    if (clientId) clearVotes.delete(clientId);
    sendPresence();
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Common Ground running on port ${PORT}`));
