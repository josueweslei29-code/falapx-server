const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const canais = {};
const falando = {};

console.log('✅ Servidor FalaPX rodando na porta 8080');

wss.on('connection', (ws) => {
  let nome = null;
  let canal = null;

  ws.on('message', (dados) => {
    try {
      const msg = JSON.parse(dados.toString());

      if (msg.tipo === 'ENTRAR') {
        nome = msg.nome;
        console.log(`👤 ${nome} conectou`);
      }
      
      if (msg.tipo === 'ENTRAR_CANAL') {
        canal = msg.canal;
        if (!canais[canal]) canais[canal] = {};
        canais[canal][nome] = ws;
        console.log(`📻 ${nome} entrou no canal ${canal}`);
        ws.send(JSON.stringify({ tipo: 'ENTRADA_CANAL_OK', canal }));
      }

      if (msg.tipo === 'INICIO_FALA') {
        canal = msg.canal;
        if (!falando[canal]) {
          falando[canal] = nome;
          console.log(`🔊 ${nome} começou a falar no canal ${canal}`);
          enviarTodos(canal, { tipo: 'INICIO_FALA', quem: nome, canal }, nome);
        }
      }

      if (msg.tipo === 'FIM_FALA') {
        canal = msg.canal;
        if (falando[canal] === nome) {
          delete falando[canal];
          console.log(`🔇 ${nome} parou de falar no canal ${canal}`);
          enviarTodos(canal, { tipo: 'FIM_FALA', quem: nome, canal });
        }
      }

      if (msg.tipo === 'AUDIO_DATA') {
        canal = msg.canal;
        enviarTodos(canal, { tipo: 'AUDIO_DATA', dados: msg.dados }, nome);
      }

    } catch (erro) {
      console.log('❌ Erro:', erro.message);
    }
  });

  ws.on('close', () => {
    console.log(`❌ ${nome} desconectou`);
    if (canal && falando[canal] === nome) {
      delete falando[canal];
      enviarTodos(canal, { tipo: 'FIM_FALA', quem: nome, canal });
    }
    if (canal && canais[canal]) delete canais[canal][nome];
  });

  function enviarTodos(numCanal, mensagem, exceto = null) {
    if (!canais[numCanal]) return;
    for (const n in canais[numCanal]) {
      if (n !== exceto && canais[numCanal][n].readyState === WebSocket.OPEN) {
        canais[numCanal][n].send(JSON.stringify(mensagem));
      }
    }
  }
});
