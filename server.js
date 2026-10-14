const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

console.log('✅ Servidor FalaPX iniciado...');
console.log('🚀 Rodando na porta:', process.env.PORT || 10000);

const usuarios = new Map();
const falandoNoCanal = new Map();

wss.on('connection', (ws) => {
  let meuNome = null;
  let meuCanal = null;

  ws.on('message', (dados) => {
    try {
      const msg = JSON.parse(dados.toString());
      
      switch (msg.tipo) {
        
        case 'ENTRAR':
          meuNome = msg.nome;
          usuarios.set(meuNome, { ws, nome: meuNome, lat: msg.lat || 0, lon: msg.lon || 0 });
          console.log(`✅ ${meuNome} conectou`);
          enviarListaUsuarios();
          break;

        case 'ENTRAR_CANAL':
          meuCanal = msg.canal;
          console.log(`📻 ${meuNome} → Canal ${meuCanal}`);
          ws.send(JSON.stringify({ tipo: 'ENTRADA_CANAL_OK', canal: meuCanal }));
          break;

        case 'SAIR_CANAL':
          if (meuCanal && falandoNoCanal.get(meuCanal) === meuNome) {
            falandoNoCanal.delete(meuCanal);
            avisarTodosNoCanal(msg.canal, { tipo: 'FIM_FALA', canal: msg.canal });
          }
          meuCanal = null;
          break;

        case 'INICIO_FALA':
          if (!falandoNoCanal.has(msg.canal)) {
            falandoNoCanal.set(msg.canal, msg.quem);
            avisarTodosNoCanal(msg.canal, { tipo: 'INICIO_FALA', quem: msg.quem, canal: msg.canal });
          }
          break;

        case 'FIM_FALA':
          if (falandoNoCanal.get(msg.canal) === msg.quem) {
            falandoNoCanal.delete(msg.canal);
            avisarTodosNoCanal(msg.canal, { tipo: 'FIM_FALA', canal: msg.canal });
          }
          break;

        case 'AUDIO_DATA':
          if (meuCanal) {
            avisarTodosNoCanal(meuCanal, { tipo: 'AUDIO_DATA', dados: msg.dados }, meuNome);
          }
          break;

        case 'ATUALIZAR_LOCALIZACAO':
          if (usuarios.has(msg.nome)) {
            const user = usuarios.get(msg.nome);
            user.lat = msg.lat;
            user.lon = msg.lon;
            enviarListaUsuarios();
          }
          break;
      }
    } catch (erro) {
      console.log('❌ Erro:', erro.message);
    }
  });

  ws.on('close', () => {
    if (meuNome) {
      console.log(`❌ ${meuNome} desconectou`);
      if (meuCanal && falandoNoCanal.get(meuCanal) === meuNome) {
        falandoNoCanal.delete(meuCanal);
        avisarTodosNoCanal(meuCanal, { tipo: 'FIM_FALA', canal: meuCanal });
      }
      usuarios.delete(meuNome);
      enviarListaUsuarios();
    }
  });

  function enviarListaUsuarios() {
    const lista = Array.from(usuarios.values()).map(u => ({ nome: u.nome, lat: u.lat, lon: u.lon }));
    usuarios.forEach(user => {
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify({ tipo: 'LISTA_USUARIOS', usuarios: lista }));
      }
    });
  }

  function avisarTodosNoCanal(canal, mensagem, ignorarNome = null) {
    usuarios.forEach((user, nome) => {
      if (nome !== ignorarNome && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(mensagem));
      }
    });
  }
});
