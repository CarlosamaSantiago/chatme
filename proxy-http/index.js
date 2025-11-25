const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const { sendToChatServer } = require('./services/chatDelegate');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==== Carpeta de audios (para notas de voz) ====
const AUDIOS_DIR = path.join(__dirname, 'audios');
if (!fs.existsSync(AUDIOS_DIR)) {
    fs.mkdirSync(AUDIOS_DIR);
}
app.use('/audios', express.static(AUDIOS_DIR));

// ========= RUTAS HTTP EXISTENTES =========

app.post('/register', async (req, res) => {
    const { username } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ action: "REGISTER", username }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/getUsers', async (req, res) => {
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ action: "GET_USERS" }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/getGroups', async (req, res) => {
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ action: "GET_GROUPS" }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/createGroup', async (req, res) => {
    const { groupName } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ action: "CREATE_GROUP", groupName }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/sendMessage', async (req, res) => {
    const { from, to, message, isGroup } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({
            action: "SEND_MESSAGE", from, to, message, isGroup
        }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/getHistory', async (req, res) => {
    const { target, from, isGroup } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({
            action: "GET_HISTORY", target, from, isGroup
        }));
        res.json(JSON.parse(respuesta));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========= HTTP + WebSocket en el mismo servidor =========

const server = http.createServer(app);

// Servidor WebSocket para notas de voz
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
    console.log('Cliente WebSocket conectado para notas de voz');

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            console.log('WS recibido:', msg);

            if (msg.action === 'SEND_VOICE') {
                const { from, to, isGroup, audioBase64, extension } = msg;

                if (!from || !to || !audioBase64) {
                    ws.send(JSON.stringify({ error: 'Datos incompletos para nota de voz' }));
                    return;
                }

                // 1. Guardar archivo de audio en disco
                const buffer = Buffer.from(audioBase64, 'base64');
                const ext = extension || 'webm';
                const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                const filePath = path.join(AUDIOS_DIR, filename);
                fs.writeFileSync(filePath, buffer);

                const audioUrl = `/audios/${filename}`; // ruta que luego usará el cliente web

                // 2. Enviar al servidor Java como un mensaje de texto especial
                //    El servidor Java solo ve esto:
                //    action: "SEND_MESSAGE", from, to, message: "__VOICE__:/audios/xxx", isGroup: ... }
                const payload = {
                    action: 'SEND_MESSAGE',
                    from,
                    to,
                    message: `__VOICE__:${audioUrl}`,
                    isGroup: !!isGroup
                };

                const respuesta = await sendToChatServer(JSON.stringify(payload));

                // Reenviar respuesta al navegador (opcional, igual el cliente hace polling de historial)
                ws.send(respuesta);
            } else {
                ws.send(JSON.stringify({ error: 'Acción WebSocket no soportada' }));
            }
        } catch (err) {
            console.error('Error en WS:', err);
            ws.send(JSON.stringify({ error: 'Error procesando mensaje de voz' }));
        }
    });

    ws.on('close', () => {
        console.log('Cliente WebSocket desconectado');
    });
});


server.listen(3000, () => console.log('Proxy HTTP + WebSocket en puerto 3000'));
