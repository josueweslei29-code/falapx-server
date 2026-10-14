const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

console.log('✅ Servidor FalaPX rodando!');

// Armazena todos os usuários conectados
const usuarios = new Map();
// Armazena quem está falando em cada canal
const falandoNoCanal = new Map(); // canal -> nome do usuário

wss.on('connection', (ws) => {
  let meuNome = null;
  let meuCanal = null;

  ws.on('message', (dados) => {
    try {
      const msg = JSON.parse(dados.toString());
      
      switch (msg.tipo) {
        
        case 'ENTRAR':
          meuNome = msg.nome;
          usuarios.set(meuNome, {
            ws,
            nome: meuNome,
            lat: msg.lat || 0,
            lon: msg.lon || 0
          });
          console.log(`✅ ${meuNome} conectou`);
          enviarListaUsuarios();
          break;

        case 'ENTRAR_CANAL':
          meuCanal = msg.canal;
          console.log(`📻 ${meuNome} entrou no canal ${meuCanal}`);
          ws.send(JSON.stringify({
            tipo: 'ENTRADA_CANAL_OK',
            canal: meuCanal
          }));
          break;

        case 'SAIR_CANAL':
          if (falandoNoCanal.get(msg.canal) === meuNome) {
            falandoNoCanal.delete(msg.canal);
            avisarTodosNoCanal(msg.canal, {
              tipo: 'FIM_FALA',
              canal: msg.canal
            });
          }
          meuCanal = null;
          console.log(`📤 ${meuNome} saiu do canal ${msg.canal}`);
          break;

        case 'INICIO_FALA':
          const canalFala = msg.canal;
          if (!falandoNoCanal.has(canalFala)) {
            falandoNoCanal.set(canalFala, msg.quem);
            avisarTodosNoCanal(canalFala, {
              tipo: 'INICIO_FALA',
              quem: msg.quem,
              canal: canalFala
            });
          }
          break;

        case 'FIM_FALA':
          const canalFim = msg.canal;
          if (falandoNoCanal.get(canalFim) === msg.quem) {
            falandoNoCanal.delete(canalFim);
            avisarTodosNoCanal(canalFim, {
              tipo: 'FIM_FALA',
              canal: canalFim
            });
          }
          break;

        case 'AUDIO_DATA':
          if (meuCanal) {
            avisarTodosNoCanal(meuCanal, {
              tipo: 'AUDIO_DATA',
              dados: msg.dados
            }, meuNome);
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
      
      // Se estava falando em algum canal, libera
      if (meuCanal && falandoNoCanal.get(meuCanal) === meuNome) {
        falandoNoCanal.delete(meuCanal);
        avisarTodosNoCanal(meuCanal, {
          tipo: 'FIM_FALA',
          canal: meuCanal
        });
      }
      
      usuarios.delete(meuNome);
      enviarListaUsuarios();
    }
  });

  function enviarListaUsuarios() {
    const lista = Array.from(usuarios.values()).map(u => ({
      nome: u.nome,
      lat: u.lat,
      lon: u.lon
    }));
    
    usuarios.forEach(user => {
      if (user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify({
          tipo: 'LISTA_USUARIOS',
          usuarios: lista
        }));
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

console.log('🚀 Servidor pronto na porta 8080');
