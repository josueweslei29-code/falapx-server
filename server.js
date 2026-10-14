const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

// Armazena: conexão → { id, nome }
const clientes = new Map();
// Mapa para garantir que cada nome só aparece UMA vez: nome → conexão ativa
const nomeParaConexao = new Map();
let idContador = 1;
let quemEstaFalando = null;

const wss = new WebSocket.Server({ port: PORT });
console.log('📻 Servidor FalaPX iniciado na porta', PORT);

wss.on('connection', (ws) => {
    const id = idContador++;
    const cliente = { id, nome: null };
    clientes.set(ws, cliente);
    console.log(`✅ Cliente conectado — ID: ${id}`);

    ws.on('message', (dados) => {
        try {
            const texto = dados.toString();
            if (texto.startsWith('{')) {
                const mensagem = JSON.parse(texto);
                processarComando(ws, mensagem);
            } else {
                if (quemEstaFalando === cliente.nome) {
                    enviarParaTodos(dados, ws);
                }
            }
        } catch {
            if (quemEstaFalando === cliente.nome) {
                enviarParaTodos(dados, ws);
            }
        }
    });

    ws.on('close', () => {
        const nome = cliente.nome;
        console.log(`❌ Cliente desconectado — ID: ${id}, Nome: ${nome || 'sem nome'}`);
        
        // Remove dos dois mapas
        clientes.delete(ws);
        if (nome) {
            // Só remove se for a conexão atual desse nome
            if (nomeParaConexao.get(nome) === ws) {
                nomeParaConexao.delete(nome);
            }
            // Se quem saiu estava falando, libera
            if (quemEstaFalando === nome) {
                quemEstaFalando = null;
                avisarFimFala();
            }
        }
        enviarListaUsuarios();
    });

    ws.on('error', (erro) => {
        console.log('⚠️ Erro:', erro.message);
    });
});

function processarComando(ws, msg) {
    const cliente = clientes.get(ws);
    if (!cliente) return;

    switch (msg.tipo) {
        case 'ENTRAR':
            const nomeNovo = msg.nome.trim();
            
            // 🔑 SE ESSE NOME JÁ ESTÁ CONECTADO → REMOVE O ANTIGO PRIMEIRO
            if (nomeParaConexao.has(nomeNovo)) {
                const conexaoAntiga = nomeParaConexao.get(nomeNovo);
                if (conexaoAntiga !== ws) {
                    console.log(`🔄 ${nomeNovo} reconectando — substituindo conexão antiga`);
                    // Marca a antiga como desconectada sem fechar a conexão abruptamente
                    clientes.delete(conexaoAntiga);
                    if (quemEstaFalando === nomeNovo) {
                        quemEstaFalando = null;
                        avisarFimFala();
                    }
                }
            }
            
            // Registra a NOVA conexão para este nome
            cliente.nome = nomeNovo;
            nomeParaConexao.set(nomeNovo, ws);
            console.log(`👤 ${nomeNovo} entrou`);
            enviarListaUsuarios();
            break;

        case 'INICIO_FALA':
            if (!quemEstaFalando) {
                quemEstaFalando = msg.quem;
                avisarInicioFala(msg.quem);
                console.log(`🔊 ${msg.quem} está transmitindo`);
            } else {
                ws.send(JSON.stringify({
                    tipo: 'AVISO',
                    mensagem: `${quemEstaFalando} está falando — aguarde!`
                }));
            }
            break;

        case 'FIM_FALA':
            if (quemEstaFalando === msg.quem) {
                quemEstaFalando = null;
                avisarFimFala();
                console.log(`🔇 Transmissão encerrada`);
            }
            break;
    }
}

function enviarListaUsuarios() {
    const lista = [];
    nomeParaConexao.forEach((conexao, nome) => {
        // Só inclui se a conexão ainda está aberta
        if (conexao.readyState === WebSocket.OPEN) {
            lista.push(nome);
        } else {
            // Limpa entradas órfãs
            nomeParaConexao.delete(nome);
        }
    });
    
    enviarParaTodos(JSON.stringify({ tipo: 'LISTA_USUARIOS', lista }));
}

function avisarInicioFala(nomeQuem) {
    enviarParaTodos(JSON.stringify({ tipo: 'INICIO_FALA', quem: nomeQuem }));
}

function avisarFimFala() {
    enviarParaTodos(JSON.stringify({ tipo: 'FIM_FALA' }));
}

function enviarParaTodos(dados, remetente = null) {
    clientes.forEach((cli, conexao) => {
        if (conexao !== remetente && conexao.readyState === WebSocket.OPEN) {
            conexao.send(dados);
        }
    });
}

console.log('✅ Servidor FalaPX PRONTO — Aguardando conexões...');
