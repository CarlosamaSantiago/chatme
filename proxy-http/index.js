const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendToChatServer } = require('./services/chatDelegate');

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

app.listen(3000, () => console.log('Proxy HTTP en puerto 3000'));
