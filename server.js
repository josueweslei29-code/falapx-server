const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const canais = {}; // canal -> { nome: ws }
const pelo = {};   // canal -> nome de quem está falando

console.log(`✅ Servidor FalaPX online na porta ${PORT}`);

wss.on('connection', (ws) => {
  let nome = null;
  let canal = null;

  ws.on('message', (dados) => {
    try {
      const mensagem = JSON.parse(dados.toString());

      // ── Entrar no servidor ──
      if (mensagem.tipo === 'ENTRAR') {
        nome = mensagem.nome;
        console.log(`👤 ${nome} conectou`);
      }

      // ── Entrar em canal ──
      if (mensagem.tipo === 'ENTRAR_CANAL') {
        // sai do canal anterior se houver
        if (canal && canais[canal] && nome) {
          delete canais[canal][nome];
        }
        canal = mensagem.canal;
        if (!canais[canal]) canais[canal] = {};
        if (nome) canais[canal][nome] = ws;
        console.log(`📻 ${nome} entrou no canal ${canal}`);
        ws.send(JSON.stringify({ tipo: 'ENTRADA_CANAL_OK', canal }));
      }

      // ── Começou a falar ──
      if (mensagem.tipo === 'INICIO_FALA') {
        canal = mensagem.canal;
        if (!pelo[canal]) {
          pelo[canal] = nome;
          console.log(`🎤 ${nome} começou a falar no canal ${canal}`);
          enviarTodos(canal, {
            tipo: 'INICIO_FALA',
            quem: nome,
            canal: canal,
            latitude: mensagem.latitude || 0,
            longitude: mensagem.longitude || 0,
            raioKm: mensagem.raioKm || 5
          }, nome);
        }
      }

      // ── Parou de falar ──
      if (mensagem.tipo === 'FIM_FALA') {
        canal = mensagem.canal;
        if (pelo[canal] === nome) {
          delete pelo[canal];
          console.log(`🔇 ${nome} parou de falar no canal ${canal}`);
          enviarTodos(canal, {
            tipo: 'FIM_FALA',
            quem: nome,
            canal: canal
          }, nome);
        }
      }

      // ── Áudio (aceita os dois nomes para compatibilidade) ──
      if (mensagem.tipo === 'AUDIO_DATA' || mensagem.tipo === 'DADOS_DE_AUDIO') {
        canal = mensagem.canal;
        enviarTodos(canal, {
          tipo: 'AUDIO_DATA',
          canal: canal,
          dados: mensagem.dados,
          latitude: mensagem.latitude || 0,
          longitude: mensagem.longitude || 0
        }, nome);
      }

      // ── Atualizar localização (opcional) ──
      if (mensagem.tipo === 'ATUALIZAR_LOCALIZACAO') {
        // só guarda/log por enquanto
      }

    } catch (erro) {
      console.log('❌ Erro:', erro.message);
    }
  });

  ws.on('close', () => {
    console.log(`❌ ${nome || 'alguém'} desconectou`);
    if (canal && pelo[canal] === nome) {
      delete pelo[canal];
      enviarTodos(canal, { tipo: 'FIM_FALA', quem: nome, canal }, nome);
    }
    if (canal && canais[canal] && nome) {
      delete canais[canal][nome];
    }
  });
});

function enviarTodos(numCanal, mensagem, exceto = null) {
  if (!canais[numCanal]) return;
  for (const n in canais[numCanal]) {
    if (n !== exceto && canais[numCanal][n].readyState === WebSocket.OPEN) {
      canais[numCanal][n].send(JSON.stringify(mensagem));
    }
  }
}
