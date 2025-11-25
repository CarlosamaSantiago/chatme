const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendToChatServer } = require('./services/chatDelegate');
const iceBridge = require('./services/iceBridge');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Aumentar límite para notas de voz

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

// Endpoints Ice RPC
app.post('/ice/registerUser', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('registerUser', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/createGroup', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('createGroup', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/sendMessage', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('sendMessage', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/sendAudio', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('sendAudio', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/sendVoiceNote', async (req, res) => {
    // Alias para compatibilidad
    try {
        const result = await iceBridge.callIceMethod('sendVoiceNote', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/startCall', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('startCall', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/getHistory', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('getHistory', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/getUsers', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('getUsers', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/ice/getGroups', async (req, res) => {
    try {
        const result = await iceBridge.callIceMethod('getGroups', req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log('Proxy HTTP en puerto 3000 (con soporte Ice RPC)'));
