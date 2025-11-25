const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendToChatServer, initializeIce } = require('./services/chatDelegate');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Almacenar clientes SSE
const clients = new Set();

// Endpoint para Server-Sent Events (tiempo real)
app.get('/updates', (req, res) => {
    console.log("🔗 Nuevo cliente conectado a SSE");
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Función callback para enviar datos al cliente
    const sendEvent = (data) => {
        res.write(`data: ${data}\n\n`);
    };

    // Inicializar Ice con este cliente
    initializeIce(sendEvent).then(success => {
        if (!success) {
            res.write('data: {"error":"No se pudo conectar al servidor"}\n\n');
        }
    });

    // Guardar referencia al cliente
    clients.add(sendEvent);

    // Limpiar cuando se desconecte
    req.on('close', () => {
        console.log("🔌 Cliente desconectado de SSE");
        clients.delete(sendEvent);
    });
});

// Rutas del API
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

app.listen(3000, () => {
    console.log('✅ Proxy HTTP ejecutándose en puerto 3000');
    console.log('🔗 SSE disponible en: http://localhost:3000/updates');
});