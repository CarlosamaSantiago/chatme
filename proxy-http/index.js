const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { sendToChatServer } = require('./services/chatDelegate');
const iceBridge = require('./services/iceBridge');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Aumentar límite para notas de voz

// Crear servidor HTTP
const server = http.createServer(app);

// Crear servidor WebSocket para tiempo real
const wss = new WebSocket.Server({ server });

// Almacenar conexiones WebSocket por usuario
const wsConnections = new Map();

// Almacenar llamadas activas: { callId: { caller, callee, status } }
const activeCalls = new Map();

// Manejar conexiones WebSocket
wss.on('connection', (ws, req) => {
    console.log('Nueva conexión WebSocket');
    
    let username = null;
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    username = data.username;
                    wsConnections.set(username, ws);
                    console.log(`Usuario WebSocket registrado: ${username}`);
                    ws.send(JSON.stringify({ 
                        type: 'registered', 
                        username: username 
                    }));
                    break;
                
                // === SEÑALIZACIÓN WEBRTC ===
                
                case 'call-offer':
                    // Usuario A envía oferta SDP a Usuario B
                    handleCallOffer(data, username);
                    break;
                
                case 'call-answer':
                    // Usuario B responde con SDP answer
                    handleCallAnswer(data, username);
                    break;
                
                case 'ice-candidate':
                    // Intercambio de candidatos ICE
                    handleIceCandidate(data, username);
                    break;
                
                case 'call-reject':
                    // Usuario rechaza la llamada
                    handleCallReject(data, username);
                    break;
                
                case 'call-end':
                    // Usuario termina la llamada
                    handleCallEnd(data, username);
                    break;
                
                default:
                    console.log('Tipo de mensaje WebSocket no reconocido:', data.type);
            }
        } catch (e) {
            console.error('Error procesando mensaje WebSocket:', e);
        }
    });
    
    ws.on('close', () => {
        if (username) {
            // Terminar llamadas activas del usuario
            activeCalls.forEach((call, callId) => {
                if (call.caller === username || call.callee === username) {
                    const otherUser = call.caller === username ? call.callee : call.caller;
                    const otherWs = wsConnections.get(otherUser);
                    if (otherWs && otherWs.readyState === WebSocket.OPEN) {
                        otherWs.send(JSON.stringify({
                            type: 'call-ended',
                            from: username,
                            reason: 'user_disconnected'
                        }));
                    }
                    activeCalls.delete(callId);
                }
            });
            
            wsConnections.delete(username);
            console.log(`Usuario WebSocket desconectado: ${username}`);
        }
    });
    
    ws.on('error', (error) => {
        console.error('Error WebSocket:', error);
    });
});

// === Funciones de señalización WebRTC ===

function handleCallOffer(data, from) {
    const { to, offer, isGroup } = data;
    console.log(`📞 Oferta de llamada: ${from} -> ${to}`);
    
    const targetWs = wsConnections.get(to);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        // Crear ID de llamada
        const callId = `${from}_${to}_${Date.now()}`;
        activeCalls.set(callId, { caller: from, callee: to, status: 'ringing' });
        
        targetWs.send(JSON.stringify({
            type: 'call-offer',
            from: from,
            to: to,
            offer: offer,
            callId: callId,
            isGroup: isGroup
        }));
    } else {
        // Usuario no disponible
        const callerWs = wsConnections.get(from);
        if (callerWs && callerWs.readyState === WebSocket.OPEN) {
            callerWs.send(JSON.stringify({
                type: 'call-failed',
                to: to,
                reason: 'user_unavailable'
            }));
        }
    }
}

function handleCallAnswer(data, from) {
    const { to, answer, callId } = data;
    console.log(`✅ Respuesta de llamada: ${from} -> ${to}`);
    
    const call = activeCalls.get(callId);
    if (call) {
        call.status = 'connected';
    }
    
    const targetWs = wsConnections.get(to);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
            type: 'call-answer',
            from: from,
            answer: answer,
            callId: callId
        }));
    }
}

function handleIceCandidate(data, from) {
    const { to, candidate } = data;
    
    const targetWs = wsConnections.get(to);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
            type: 'ice-candidate',
            from: from,
            candidate: candidate
        }));
    }
}

function handleCallReject(data, from) {
    const { to, callId } = data;
    console.log(`❌ Llamada rechazada: ${from} rechazó llamada de ${to}`);
    
    activeCalls.delete(callId);
    
    const targetWs = wsConnections.get(to);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
            type: 'call-rejected',
            from: from
        }));
    }
}

function handleCallEnd(data, from) {
    const { to, callId } = data;
    console.log(`📴 Llamada terminada: ${from}`);
    
    activeCalls.delete(callId);
    
    const targetWs = wsConnections.get(to);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
            type: 'call-ended',
            from: from,
            reason: 'call_ended'
        }));
    }
}

// Función para enviar mensajes en tiempo real
function broadcastMessage(message, targetUser, isGroup, senderUser) {
    const messageData = {
        type: 'newMessage',
        message: message
    };
    
    if (isGroup) {
        // Enviar a todos los usuarios conectados
        wsConnections.forEach((ws, user) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(messageData));
            }
        });
    } else {
        // Enviar al destinatario
        const targetWs = wsConnections.get(targetUser);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(messageData));
        }
        // Enviar al remitente también
        const senderWs = wsConnections.get(senderUser);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify(messageData));
        }
    }
}

// Función para notificar llamadas
function notifyCall(from, to, isGroup) {
    const callData = {
        type: 'incomingCall',
        from: from,
        to: to,
        isGroup: isGroup
    };
    
    if (isGroup) {
        wsConnections.forEach((ws, user) => {
            if (ws.readyState === WebSocket.OPEN && user !== from) {
                ws.send(JSON.stringify(callData));
            }
        });
    } else {
        const targetWs = wsConnections.get(to);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(callData));
        }
    }
}

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
        const result = JSON.parse(respuesta);
        
        // Notificar a todos los usuarios conectados
        wsConnections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'groupCreated', 
                    groupName: groupName 
                }));
            }
        });
        
        res.json(result);
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
        const result = JSON.parse(respuesta);
        
        // Enviar mensaje en tiempo real
        const messageData = {
            from: from,
            to: to,
            message: message,
            isGroup: isGroup,
            timestamp: new Date().toISOString(),
            type: 'text'
        };
        broadcastMessage(messageData, to, isGroup, from);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/sendVoiceNote', async (req, res) => {
    const { from, to, audioData, isGroup } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ 
            action: "SEND_VOICE_NOTE", 
            from, 
            to, 
            audioData: audioData,
            isGroup 
        }));
        const result = JSON.parse(respuesta);
        
        // Enviar mensaje en tiempo real
        const messageData = {
            from: from,
            to: to,
            message: '[Nota de voz]',
            isGroup: isGroup,
            timestamp: new Date().toISOString(),
            type: 'audio',
            audioData: audioData
        };
        broadcastMessage(messageData, to, isGroup, from);
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/startCall', async (req, res) => {
    const { from, to, isGroup } = req.body;
    try {
        const respuesta = await sendToChatServer(JSON.stringify({ 
            action: "START_CALL", from, to, isGroup 
        }));
        const result = JSON.parse(respuesta);
        
        // Notificar llamada entrante via WebSocket
        notifyCall(from, to, isGroup);
        
        res.json(result);
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

// Endpoints Ice RPC (mantener compatibilidad)
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

// Iniciar servidor
const PORT = 3000;
server.listen(PORT, () => {
    console.log('===========================================');
    console.log(`Proxy HTTP en puerto ${PORT}`);
    console.log(`WebSocket server activo en ws://localhost:${PORT}`);
    console.log('Soporte Ice RPC habilitado');
    console.log('===========================================');
});
