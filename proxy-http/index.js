const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const iceBridge = require('./services/iceBridge');

// NOTA: Este proxy usa ZeroC Ice para comunicarse con el backend Java
// La comunicación es: Cliente Web <-> Proxy HTTP <-> Ice RPC <-> IceChatServer Java

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
                    console.log(`   Total de usuarios conectados: ${wsConnections.size}`);
                    
                    // Notificar a TODOS los demás usuarios que hay un nuevo usuario conectado
                    wsConnections.forEach((otherWs, otherUser) => {
                        if (otherUser !== username && otherWs.readyState === WebSocket.OPEN) {
                            try {
                                otherWs.send(JSON.stringify({
                                    type: 'userRegistered',
                                    username: username
                                }));
                                console.log(`   ✅ Notificación de nuevo usuario enviada a: ${otherUser}`);
                            } catch (e) {
                                console.error(`   ❌ Error notificando a ${otherUser}:`, e.message);
                            }
                        }
                    });
                    
                    // Suscribir usuario a notificaciones Ice
                    // Esperar un momento para asegurar que Ice esté completamente conectado
                    setTimeout(() => {
                        if (iceBridge.connected && !iceSubscribedUsers.has(username)) {
                            iceBridge.subscribe(username).then(() => {
                                iceSubscribedUsers.add(username);
                                console.log(`✅ Usuario ${username} suscrito a Ice callbacks (WebSocket bidireccional)`);
                            }).catch(err => {
                                console.error(`❌ Error suscribiendo ${username} a Ice:`, err.message);
                                // Intentar nuevamente después de un segundo
                                setTimeout(() => {
                                    if (iceBridge.connected && !iceSubscribedUsers.has(username)) {
                                        iceBridge.subscribe(username).then(() => {
                                            iceSubscribedUsers.add(username);
                                            console.log(`✅ Usuario ${username} suscrito a Ice callbacks (reintento exitoso)`);
                                        }).catch(err2 => {
                                            console.error(`❌ Error en reintento de suscripción para ${username}:`, err2.message);
                                        });
                                    }
                                }, 1000);
                            });
                        } else if (!iceBridge.connected) {
                            console.log(`⚠️  Ice no está conectado, usuario ${username} no se puede suscribir aún`);
                        }
                    }, 500);
                    
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
            // Desuscribir de Ice
            if (iceSubscribedUsers.has(username)) {
                iceBridge.unsubscribe(username).then(() => {
                    iceSubscribedUsers.delete(username);
                    console.log(`✅ Usuario ${username} desuscrito de Ice`);
                }).catch(err => {
                    console.error(`❌ Error desuscribiendo ${username} de Ice:`, err);
                });
            }
            
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
            console.log(`   Total de usuarios conectados: ${wsConnections.size}`);
            
            // Notificar a los demás usuarios que este usuario se desconectó
            wsConnections.forEach((otherWs, otherUser) => {
                if (otherWs.readyState === WebSocket.OPEN) {
                    try {
                        otherWs.send(JSON.stringify({
                            type: 'userDisconnected',
                            username: username
                        }));
                    } catch (e) {
                        console.error(`   Error notificando desconexión a ${otherUser}:`, e.message);
                    }
                }
            });
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

// NOTA: Las funciones broadcastMessage y notifyCall fueron eliminadas
// porque ahora usamos callbacks Ice para notificaciones en tiempo real
// Los mensajes llegan via Ice callbacks y se reenvían automáticamente

// =====================================================
// ENDPOINTS USANDO ICE RPC (ZeroC Ice)
// Toda la comunicación con el backend usa Ice
// =====================================================

app.post('/register', async (req, res) => {
    const { username } = req.body;
    try {
        console.log(`📡 [Ice RPC] registerUser: ${username}`);
        const result = await iceBridge.callIceMethod('registerUser', { username });
        
        // Notificar a TODOS los usuarios conectados que hay un nuevo usuario
        // Esto permite que las listas se actualicen en tiempo real
        wsConnections.forEach((ws, user) => {
            if (ws.readyState === WebSocket.OPEN && user !== username) {
                try {
                    ws.send(JSON.stringify({
                        type: 'userRegistered',
                        username: username
                    }));
                    console.log(`✅ Notificación de nuevo usuario enviada a: ${user}`);
                } catch (e) {
                    console.error(`   Error notificando a ${user}:`, e.message);
                }
            }
        });
        
        res.json({ action: "REGISTERED", username, ...result });
    } catch (error) {
        console.error("Error en register:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/getUsers', async (req, res) => {
    try {
        console.log(`📡 [Ice RPC] getUsers`);
        const result = await iceBridge.callIceMethod('getUsers', {});
        res.json(result);
    } catch (error) {
        console.error("Error en getUsers:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/getGroups', async (req, res) => {
    try {
        console.log(`📡 [Ice RPC] getGroups`);
        const result = await iceBridge.callIceMethod('getGroups', {});
        res.json(result);
    } catch (error) {
        console.error("Error en getGroups:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/createGroup', async (req, res) => {
    const { groupName } = req.body;
    try {
        console.log(`📡 [Ice RPC] createGroup: ${groupName}`);
        const result = await iceBridge.callIceMethod('createGroup', { groupName });
        
        // Notificar a todos los usuarios conectados via WebSocket
        wsConnections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    type: 'groupCreated', 
                    groupName: groupName 
                }));
            }
        });
        
        res.json({ action: "GROUP_CREATED", groupName, ...result });
    } catch (error) {
        console.error("Error en createGroup:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/sendMessage', async (req, res) => {
    const { from, to, message, isGroup } = req.body;
    try {
        console.log(`📡 [Ice RPC] sendMessage: ${from} -> ${to}`);
        const result = await iceBridge.callIceMethod('sendMessage', { from, to, message, isGroup });
        
        // El mensaje será notificado automáticamente via Ice callbacks (WebSocket bidireccional)
        // Los callbacks Ice invocan MessageCallbackI.onMessage() que envía via WebSocket del proxy
        // Si los callbacks no funcionan, el mensaje se perderá (pero se guardará en historial)
        
        console.log(`✅ Mensaje enviado via Ice RPC, esperando callback...`);
        res.json({ action: "MESSAGE_SENT", ...result });
    } catch (error) {
        console.error("Error en sendMessage:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/sendVoiceNote', async (req, res) => {
    const { from, to, audioData, isGroup } = req.body;
    try {
        console.log(`📡 [Ice RPC] sendAudio: ${from} -> ${to}`);
        const result = await iceBridge.callIceMethod('sendAudio', { from, to, audioData, isGroup });
        
        // El mensaje será notificado automáticamente via Ice callbacks (WebSocket bidireccional)
        // Los callbacks Ice invocan MessageCallbackI.onMessage() que envía via WebSocket del proxy
        
        res.json({ action: "VOICE_NOTE_SENT", ...result });
    } catch (error) {
        console.error("Error en sendVoiceNote:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/startCall', async (req, res) => {
    const { from, to, isGroup } = req.body;
    try {
        console.log(`📡 [Ice RPC] startCall: ${from} -> ${to}`);
        const result = await iceBridge.callIceMethod('startCall', { from, to, isGroup });
        
        // La notificación de llamada se manejará via Ice callbacks si está implementado
        // Por ahora, las llamadas usan WebRTC con señalización via WebSocket propio
        
        res.json({ action: "CALL_STARTED", ...result });
    } catch (error) {
        console.error("Error en startCall:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/getHistory', async (req, res) => {
    const { target, from, isGroup } = req.body;
    try {
        console.log(`📡 [Ice RPC] getHistory: ${target}`);
        const result = await iceBridge.callIceMethod('getHistory', { target, fromUser: from, isGroup });
        res.json(result);
    } catch (error) {
        console.error("Error en getHistory:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// NOTA: Los endpoints principales (/register, /sendMessage, etc.) ya usan Ice RPC
// No se necesitan endpoints duplicados en /ice/*

// Mapa para rastrear usuarios suscritos a Ice
const iceSubscribedUsers = new Set();

// Configurar handler de mensajes de Ice ANTES de iniciar el servidor
// Esto asegura que los callbacks Ice puedan enviar mensajes cuando lleguen
function setupIceMessageHandler() {
    iceBridge.setMessageHandler((data) => {
        // data tiene { type: 'newMessage', message: {...} }
        if (data.type === 'newMessage') {
            const message = data.message;
            const targetUser = message.to;
            const isGroup = message.isGroup;
            
            console.log(`📨 [Ice Callback] Mensaje recibido: ${message.from} -> ${targetUser} (grupo: ${isGroup})`);
            console.log(`   Contenido: ${message.message?.substring(0, 50) || message.content?.substring(0, 50) || 'N/A'}...`);
            console.log(`   Usuarios conectados: ${wsConnections.size}`);
            
            // Asegurar que el mensaje tenga la estructura correcta
            const messageToSend = {
                from: message.from || '',
                to: message.to || '',
                message: message.message || message.content || '',
                timestamp: message.timestamp || Date.now().toString(),
                isGroup: message.isGroup || false,
                type: message.type || 'text',
                audioData: message.audioData || null
            };
            
            // Enviar mensaje via WebSocket a los usuarios conectados
            if (isGroup) {
                // Enviar a todos los usuarios conectados
                let sentCount = 0;
                wsConnections.forEach((ws, user) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        try {
                            ws.send(JSON.stringify({
                                type: 'newMessage',
                                message: messageToSend
                            }));
                            sentCount++;
                            console.log(`   ✅ Enviado a usuario: ${user}`);
                        } catch (e) {
                            console.error(`   ❌ Error enviando a ${user}:`, e.message);
                        }
                    } else {
                        console.log(`   ⚠️  Usuario ${user} tiene WebSocket cerrado`);
                    }
                });
                console.log(`✅ Mensaje grupal enviado a ${sentCount}/${wsConnections.size} usuarios conectados`);
            } else {
                // Mensaje directo: enviar al destinatario Y al remitente
                let sentToTarget = false;
                let sentToSender = false;
                
                // Enviar al destinatario
                const targetWs = wsConnections.get(targetUser);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    try {
                        targetWs.send(JSON.stringify({
                            type: 'newMessage',
                            message: messageToSend
                        }));
                        sentToTarget = true;
                        console.log(`✅ Mensaje enviado a destinatario: ${targetUser}`);
                    } catch (e) {
                        console.error(`   ❌ Error enviando a destinatario ${targetUser}:`, e.message);
                    }
                } else {
                    console.log(`⚠️  Destinatario ${targetUser} no está conectado (WS no disponible o cerrado)`);
                    if (targetWs) {
                        console.log(`   Estado WebSocket: ${targetWs.readyState} (OPEN=${WebSocket.OPEN})`);
                    }
                }
                
                // También enviar al remitente (para que vea su propio mensaje con timestamp del servidor)
                const senderWs = wsConnections.get(messageToSend.from);
                if (senderWs && senderWs.readyState === WebSocket.OPEN) {
                    try {
                        senderWs.send(JSON.stringify({
                            type: 'newMessage',
                            message: messageToSend
                        }));
                        sentToSender = true;
                        console.log(`✅ Mensaje enviado a remitente: ${messageToSend.from}`);
                    } catch (e) {
                        console.error(`   ❌ Error enviando a remitente ${messageToSend.from}:`, e.message);
                    }
                } else {
                    console.log(`⚠️  Remitente ${messageToSend.from} no está conectado (WS no disponible o cerrado)`);
                    if (senderWs) {
                        console.log(`   Estado WebSocket: ${senderWs.readyState} (OPEN=${WebSocket.OPEN})`);
                    }
                }
                
                console.log(`📊 Resumen: Destinatario=${sentToTarget ? '✅' : '❌'}, Remitente=${sentToSender ? '✅' : '❌'}`);
            }
        } else {
            console.log(`⚠️  Tipo de mensaje Ice desconocido: ${data.type}`);
        }
    });
    console.log('✅ Handler de mensajes Ice configurado');
}

// Configurar handler inmediatamente
setupIceMessageHandler();

// Iniciar servidor y conectar a Ice
const PORT = 3000;
server.listen(PORT, async () => {
    console.log('===========================================');
    console.log(`Proxy HTTP en puerto ${PORT}`);
    console.log(`WebSocket server activo en ws://localhost:${PORT}`);
    console.log('===========================================');
    console.log('Conectando al servidor Ice...');
    
    // Intentar conectar a Ice, pero no bloquear el inicio del servidor
    iceBridge.connect().then(() => {
        console.log('✅ Proxy listo - usando ZeroC Ice RPC');
        console.log('✅ Conectado a Ice WebSocket en ws://localhost:10000');
    }).catch(error => {
        console.error('⚠️  No se pudo conectar a Ice, asegúrese de que IceChatServer esté ejecutándose');
        console.error('Error:', error.message);
        console.log('⚠️  El proxy continuará ejecutándose, pero las funciones Ice no estarán disponibles');
        console.log('⚠️  Inicie el servidor Java y reinicie el proxy para habilitar Ice RPC');
    });
    
    console.log('===========================================');
    console.log('✅ Servidor HTTP listo y escuchando en puerto', PORT);
    console.log('===========================================');
});
