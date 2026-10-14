const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

// Armazena todos os clientes conectados
const clientes = new Map(); // chave: conexão, valor: { nome, id }
let idContador = 1;
let quemEstaFalando = null; // nome de quem está transmitindo agora

// Inicia o servidor
const wss = new WebSocket.Server({ port: PORT });
console.log('📻 Servidor FalaPX iniciado na porta', PORT);

// Quando alguém se conecta
wss.on('connection', (ws) => {
    const id = idContador++;
    const cliente = { id, nome: null };
    clientes.set(ws, cliente);
    
    console.log(`✅ Novo cliente conectado — ID: ${id}`);

    // Recebe mensagem do cliente
    ws.on('message', (dados) => {
        try {
            // Tenta interpretar como texto (comandos)
            const texto = dados.toString();
            const primeiraLetra = texto.slice(0, 1);
            
            // Se começar com { é JSON = comando
            if (primeiraLetra === '{') {
                const mensagem = JSON.parse(texto);
                processarComando(ws, mensagem);
            } else {
                // Senão é áudio binário = encaminha
                if (quemEstaFalando === cliente.nome) {
                    enviarParaTodos(dados, ws);
                }
            }
        } catch (erro) {
            // Se não for texto, é áudio = encaminha
            if (quemEstaFalando === cliente.nome) {
                enviarParaTodos(dados, ws);
            }
        }
    });

    // Quando alguém sai
    ws.on('close', () => {
        const nome = cliente.nome;
        console.log(`❌ Cliente desconectado — ID: ${id}, Nome: ${nome || 'sem nome'}`);
        
        clientes.delete(ws);
        
        // Se quem saiu estava falando, libera todos
        if (quemEstaFalando === nome) {
            quemEstaFalando = null;
            avisarFimFala();
        }
        
        // Atualiza lista para os que ficaram
        enviarListaUsuarios();
    });

    ws.on('error', (erro) => {
        console.log('⚠️ Erro na conexão:', erro.message);
    });
});

// 📋 PROCESSAR COMANDOS
function processarComando(ws, msg) {
    const cliente = clientes.get(ws);
    if (!cliente) return;

    switch (msg.tipo) {
        // Usuário entrou com seu nome
        case 'ENTRAR':
            cliente.nome = msg.nome;
            console.log(`👤 ${msg.nome} entrou na sala`);
            enviarListaUsuarios();
            break;

        // Começou a falar
        case 'INICIO_FALA':
            if (!quemEstaFalando) {
                quemEstaFalando = msg.quem;
                avisarInicioFala(msg.quem);
                console.log(`🔊 ${msg.quem} começou a transmitir`);
            } else {
                // Alguém já está falando — avisa que está ocupado
                ws.send(JSON.stringify({
                    tipo: 'AVISO',
                    mensagem: `${quemEstaFalando} está falando — aguarde!`
                }));
            }
            break;

        // Terminou de falar
        case 'FIM_FALA':
            if (quemEstaFalando === msg.quem) {
                quemEstaFalando = null;
                avisarFimFala();
                console.log(`🔇 Transmissão encerrada`);
            }
            break;
    }
}

// 📡 Enviar lista de usuários para todos
function enviarListaUsuarios() {
    const lista = [];
    clientes.forEach((cli) => {
        if (cli.nome) lista.push(cli.nome);
    });
    
    const mensagem = JSON.stringify({
        tipo: 'LISTA_USUARIOS',
        lista: lista
    });
    
    enviarParaTodos(mensagem);
}

// 🔊 Avisar: alguém começou a falar
function avisarInicioFala(nomeQuem) {
    const mensagem = JSON.stringify({
        tipo: 'INICIO_FALA',
        quem: nomeQuem
    });
    enviarParaTodos(mensagem);
}

// 🔇 Avisar: alguém terminou de falar
function avisarFimFala() {
    const mensagem = JSON.stringify({
        tipo: 'FIM_FALA'
    });
    enviarParaTodos(mensagem);
}

// 📤 Enviar algo para TODOS os conectados (exceto quem enviou, no caso de áudio)
function enviarParaTodos(dados, remetente = null) {
    clientes.forEach((cli, conexao) => {
        if (conexao !== remetente && conexao.readyState === WebSocket.OPEN) {
            conexao.send(dados);
        }
    });
}

console.log('✅ Servidor FalaPX PRONTO e ESCUTANDO na porta', PORT);
console.log('📍 Aguardando conexões...');
