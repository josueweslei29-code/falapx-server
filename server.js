const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// canal -> { nome: { ws, lat, lon } }
const canais = {};
// canal -> nome de quem está falando
const pelo = {};

console.log(`✅ Servidor FalaPX online na porta ${PORT}`);

wss.on('connection', (ws) => {
  let nome = null;
  let canal = null;
  let lat = 0;
  let lon = 0;

  ws.on('message', (dados) => {
    try {
      const mensagem = JSON.parse(dados.toString());

      if (mensagem.tipo === 'ENTRAR') {
        nome = mensagem.nome;
        if (mensagem.latitude != null) lat = mensagem.latitude;
        if (mensagem.longitude != null) lon = mensagem.longitude;
        console.log(`👤 ${nome} conectou`);
      }

      if (mensagem.tipo === 'ENTRAR_CANAL') {
        if (canal && canais[canal] && nome) {
          delete canais[canal][nome];
          broadcastUsuarios(canal);
        }
        canal = mensagem.canal;
        if (!canais[canal]) canais[canal] = {};
        if (nome) {
          canais[canal][nome] = { ws, lat, lon };
        }
        console.log(`📻 ${nome} entrou no canal ${canal}`);
        ws.send(JSON.stringify({ tipo: 'ENTRADA_CANAL_OK', canal }));
        broadcastUsuarios(canal);
      }

      if (mensagem.tipo === 'ATUALIZAR_LOCALIZACAO') {
        if (mensagem.latitude != null) lat = mensagem.latitude;
        if (mensagem.longitude != null) lon = mensagem.longitude;
        if (canal && canais[canal] && nome && canais[canal][nome]) {
          canais[canal][nome].lat = lat;
          canais[canal][nome].lon = lon;
          broadcastUsuarios(canal);
        }
      }

      if (mensagem.tipo === 'INICIO_FALA') {
        canal = mensagem.canal;
        if (mensagem.latitude != null) lat = mensagem.latitude;
        if (mensagem.longitude != null) lon = mensagem.longitude;
        if (!pelo[canal]) {
          pelo[canal] = nome;
          console.log(`🎤 ${nome} começou a falar no canal ${canal}`);
          enviarTodos(canal, {
            tipo: 'INICIO_FALA',
            quem: nome,
            canal: canal,
            latitude: lat,
            longitude: lon,
            raioKm: mensagem.raioKm || 5
          }, nome);
          broadcastUsuarios(canal);
        }
      }

      if (mensagem.tipo === 'FIM_FALA') {
        canal = mensagem.canal;
        if (pelo[canal] === nome) {
          delete pelo[canal];
          console.log(`🔇 ${nome} parou de falar no canal ${canal}`);
          enviarTodos(canal, { tipo: 'FIM_FALA', quem: nome, canal }, nome);
          broadcastUsuarios(canal);
        }
      }

      if (mensagem.tipo === 'AUDIO_DATA' || mensagem.tipo === 'DADOS_DE_AUDIO') {
        canal = mensagem.canal;
        enviarTodos(canal, {
          tipo: 'AUDIO_DATA',
          canal: canal,
          dados: mensagem.dados,
          latitude: mensagem.latitude || lat,
          longitude: mensagem.longitude || lon
        }, nome);
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
      broadcastUsuarios(canal);
    }
  });
});

function enviarTodos(numCanal, mensagem, exceto = null) {
  if (!canais[numCanal]) return;
  for (const n in canais[numCanal]) {
    const client = canais[numCanal][n];
    const sock = client.ws || client;
    if (n !== exceto && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(mensagem));
    }
  }
}

function broadcastUsuarios(numCanal) {
  if (!canais[numCanal]) return;
  const lista = [];
  for (const n in canais[numCanal]) {
    const u = canais[numCanal][n];
    lista.push({
      nome: n,
      latitude: u.lat || 0,
      longitude: u.lon || 0,
      falando: pelo[numCanal] === n
    });
  }
  const msg = { tipo: 'USUARIOS', lista };
  for (const n in canais[numCanal]) {
    const sock = canais[numCanal][n].ws || canais[numCanal][n];
    if (sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify(msg));
    }
  }
}
