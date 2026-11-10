const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const images = [];
const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.replace(/^\//, '');
  const filePath = path.join(__dirname, file);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
});
const wss = new WebSocket.Server({ server });
wss.on('connection', socket => {
  socket.send(JSON.stringify({ type: 'snapshot', items: images }));
  socket.on('message', raw => {
    try { const message = JSON.parse(raw); if (message.type !== 'image' || !message.item?.src) return; images.push(message.item); wss.clients.forEach(client => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'image', item: message.item })); }); } catch (_) {}
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Common Ground running on port ${PORT}`));
