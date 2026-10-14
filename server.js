const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const wss = new WebSocket.Server({ port: PORT });

console.log(`Servidor rodando na porta ${PORT}`);

wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  ws.on('message', (message) => {
    console.log('Mensagem recebida:', message);
    
    // Encaminha a mensagem para todos os outros clientes
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });

  ws.on('error', (error) => {
    console.error('Erro:', error);
  });
});
