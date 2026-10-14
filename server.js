const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

const canais = {};
const quemEstaFalando = {};

console.log('✅ Servidor FalaPX rodando na porta 8080');

wss.on('connection', (ws) => {
    let meuNome = null;
    let meuCanal = null;

    ws.on('message', (dados) => {
        try {
            const msg = JSON.parse(dados.toString());

            switch (msg.tipo) {
                case 'ENTRAR':
                    meuNome = msg.nome;
                    console.log(`👤 ${meuNome} conectou`);
                    break;

                case 'ENTRAR_CANAL':
                    meuCanal = msg.canal;
                    if (!canais[meuCanal]) canais[meuCanal] = {};
                    canais[meuCanal][meuNome] = ws;
                    console.log(`📻 ${meuNome} entrou no Canal ${meuCanal}`);
                    ws.send(JSON.stringify({ tipo: 'ENTRADA_CANAL_OK', canal: meuCanal }));
                    break;

                case 'SAIR_CANAL':
                    if (meuCanal && canais[meuCanal]) delete canais[meuCanal][meuNome];
                    if (quemEstaFalando[meuCanal] === meuNome) {
                        delete quemEstaFalando[meuCanal];
                        avisarTodosCanal(meuCanal, { tipo: 'FIM_FALA', quem: meuNome, canal: meuCanal });
                    }
                    meuCanal = null;
                    break;

                case 'INICIO_FALA':
                    meuCanal = msg.canal;
                    if (!quemEstaFalando[meuCanal]) {
                        quemEstaFalando[meuCanal] = meuNome;
                        console.log(`🔊 ${meuNome} falando no Canal ${meuCanal}`);
                        avisarTodosCanal(meuCanal, { tipo: 'INICIO_FALA', quem: meuNome, canal: meuCanal }, meuNome);
                    }
                    break;

                case 'FIM_FALA':
                    meuCanal = msg.canal;
                    if (quemEstaFalando[meuCanal] === meuNome) {
                        delete quemEstaFalando[meuCanal];
                        console.log(`🔇 ${meuNome} parou no Canal ${meuCanal}`);
                        avisarTodosCanal(meuCanal, { tipo: 'FIM_FALA', quem: meuNome, canal: meuCanal }, meuNome);
                    }
                    break;

                case 'AUDIO_DATA':
                    avisarTodosCanal(meuCanal, { tipo: 'AUDIO_DATA', dados: msg.dados }, meuNome);
                    break;
            }
        } catch (erro) {
            console.log('❌ Erro:', erro.message);
        }
    });

    ws.on('close', () => {
        console.log(`❌ ${meuNome} desconectou`);
        if (meuCanal && canais[meuCanal]) delete canais[meuCanal][meuNome];
        if (meuCanal && quemEstaFalando[meuCanal] === meuNome) {
            delete quemEstaFalando[meuCanal];
            avisarTodosCanal(meuCanal, { tipo: 'FIM_FALA', quem: meuNome, canal: meuCanal });
        }
    });

    function avisarTodosCanal(numeroCanal, mensagem, exceto = null) {
        if (!canais[numeroCanal]) return;
        for (const nome in canais[numeroCanal]) {
            if (nome !== exceto && canais[numeroCanal][nome].readyState === WebSocket.OPEN) {
                canais[numeroCanal][nome].send(JSON.stringify(mensagem));
            }
        }
    }
});
