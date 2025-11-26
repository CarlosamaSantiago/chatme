// Bridge para comunicación con IceChatServer usando ZeroC Ice RPC
// Conecta al endpoint WebSocket de Ice (ws://localhost:10000)
// Usa Ice RPC para todas las operaciones

const Ice = require('ice').Ice;
// Cargar módulo Chat generado
// El módulo se exporta como { Chat: {...} }, así que necesitamos extraer Chat
const ChatModule = require('../generated/Chat');
const Chat = ChatModule.Chat;

class IceBridge {
    constructor() {
        this.ICE_ENDPOINT = 'ws -h 192.168.131.133 -p 10000';
        this.SERVICE_NAME = 'ChatService';
        this.communicator = null;
        this.chatService = null;
        this.callbackAdapter = null;
        this.callbackServant = null;
        this.callbackProxy = null;
        this.messageHandler = null; // Función para manejar mensajes recibidos
        this.connected = false;
    }

    // Inicializar conexión con Ice
    async connect() {
        try {
            console.log('🔌 Inicializando Ice Communicator...');
            
            // Inicializar communicator
            this.communicator = Ice.initialize();
            
            // Obtener proxy del ChatService primero
            const serviceProxy = this.communicator.stringToProxy(
                `${this.SERVICE_NAME}:${this.ICE_ENDPOINT}`
            );
            
            // checkedCast puede ser asíncrono en Ice para Node.js
            this.chatService = await Chat.ChatServicePrx.checkedCast(serviceProxy);
            
            if (!this.chatService) {
                throw new Error('No se pudo obtener el proxy del ChatService');
            }
            
            // Hacer una llamada al servidor para establecer la conexión
            // Esto es necesario antes de poder obtener la conexión con ice_getConnection()
            try {
                await this.chatService.getUsers();
                console.log('✅ Conexión establecida con el servidor Ice');
            } catch (e) {
                // Ignorar errores de la llamada, solo necesitamos establecer la conexión
                console.log('⚠️  Nota: Error en llamada inicial (puede ser normal):', e.message);
            }
            
            // Configurar callbacks Ice para recibir notificaciones en tiempo real
            // Con WebSocket, Ice soporta conexiones bidireccionales automáticamente
            // El servidor puede invocar callbacks a través de la misma conexión WebSocket
            try {
                // Crear adapter sin nombre para el callback
                // En cliente Node.js, createObjectAdapter retorna una Promise
                this.callbackAdapter = await this.communicator.createObjectAdapter("");
                
                // Crear e implementar el callback servant
                this.callbackServant = new MessageCallbackI(this);
                const callbackIdentity = this.communicator.stringToIdentity("MessageCallback");
                this.callbackAdapter.add(this.callbackServant, callbackIdentity);
                this.callbackAdapter.activate();
                
                // Crear proxy del callback
                // Este proxy será pasado al servidor para que pueda invocar callbacks
                const callbackObj = this.callbackAdapter.createProxy(callbackIdentity);
                
                // Obtener la conexión del servicio para asociar el callback con la conexión WebSocket
                const connection = this.chatService.ice_getConnection();
                
                if (connection) {
                    // Con WebSocket, Ice soporta callbacks bidireccionales
                    // Para que funcione correctamente, el callback debe estar en la misma conexión
                    // Usamos ice_connectionId para asociar el callback con la conexión del servicio
                    try {
                        const connectionId = connection.ice_getConnectionId();
                        const callbackWithConnection = callbackObj.ice_connectionId(connectionId);
                        this.callbackProxy = Chat.MessageCallbackPrx.uncheckedCast(callbackWithConnection);
                        console.log('✅ Callback proxy creado y asociado con conexión WebSocket bidireccional');
                        console.log('   Connection ID:', connectionId);
                        console.log('✅ El servidor podrá invocar callbacks a través de la conexión WebSocket');
                    } catch (e) {
                        // Si falla, usar el proxy sin connectionId (puede funcionar de todas formas)
                        console.warn('⚠️  No se pudo asociar callback con connectionId, usando proxy directo:', e.message);
                        this.callbackProxy = Chat.MessageCallbackPrx.uncheckedCast(callbackObj);
                    }
                } else {
                    // Si no hay conexión, aún podemos crear el proxy
                    // El servidor intentará invocarlo cuando se suscriba
                    this.callbackProxy = Chat.MessageCallbackPrx.uncheckedCast(callbackObj);
                    console.log('⚠️  Callback proxy creado (conexión se establecerá al suscribirse)');
                }
            } catch (adapterError) {
                console.error('❌ Error configurando callbacks Ice:', adapterError.message);
                throw new Error('No se pudieron configurar los callbacks Ice. El sistema requiere callbacks para tiempo real.');
            }
            
            this.connected = true;
            console.log('✅ Conectado a Ice RPC en', this.ICE_ENDPOINT);
            return true;
            
        } catch (error) {
            console.error('❌ Error conectando a Ice:', error);
            this.connected = false;
            throw error;
        }
    }

    // Establecer handler para mensajes recibidos
    setMessageHandler(handler) {
        this.messageHandler = handler;
    }

    // Suscribirse a notificaciones para un usuario
    async subscribe(username) {
        if (!this.connected || !this.chatService) {
            throw new Error('No conectado a Ice');
        }
        
        // Verificar que tenemos un callback proxy válido
        if (!this.callbackProxy) {
            console.warn(`⚠️  No hay callback proxy disponible para ${username}`);
            console.warn('⚠️  Los mensajes no se actualizarán automáticamente hasta que se configure el callback');
            return; // No lanzar error, solo advertir
        }
        
        try {
            console.log(`📡 Suscribiendo usuario ${username} a callbacks Ice...`);
            await this.chatService.subscribe(this.callbackProxy, username);
            console.log(`✅ Usuario ${username} suscrito a notificaciones Ice (WebSocket bidireccional)`);
            console.log(`   El servidor ahora puede invocar callbacks para ${username}`);
        } catch (error) {
            console.error(`❌ Error suscribiendo usuario ${username} a Ice callbacks:`, error);
            console.error('   Detalles:', error.message);
            if (error.stack) {
                console.error('   Stack:', error.stack);
            }
            throw error; // Lanzar error para que se maneje apropiadamente
        }
    }

    // Desuscribirse
    async unsubscribe(username) {
        if (!this.connected || !this.chatService) {
            return;
        }
        
        try {
            await this.chatService.unsubscribe(username);
            console.log(`✅ Usuario ${username} desuscrito`);
        } catch (error) {
            console.error(`❌ Error desuscribiendo usuario ${username}:`, error);
        }
    }

    // Llamar método Ice
    async callIceMethod(method, params) {
        if (!this.connected || !this.chatService) {
            throw new Error('No conectado a Ice. Asegúrese de llamar connect() primero.');
        }

        try {
            let result;
            
            switch (method) {
                case 'registerUser':
                    await this.chatService.registerUser(params.username);
                    result = { action: "REGISTERED", username: params.username };
                    break;
                    
                case 'createGroup':
                    await this.chatService.createGroup(params.groupName);
                    result = { action: "GROUP_CREATED", groupName: params.groupName };
                    break;
                    
                case 'sendMessage':
                    await this.chatService.sendMessage(
                        params.from,
                        params.to,
                        params.message,
                        params.isGroup || false
                    );
                    result = { action: "MESSAGE_SENT" };
                    break;
                    
                case 'sendAudio':
                case 'sendVoiceNote':
                    // Convertir Base64 a Buffer y luego a array de bytes
                    const audioBuffer = Buffer.from(params.audioData, 'base64');
                    const audioBytes = new Uint8Array(audioBuffer);
                    await this.chatService.sendAudio(
                        params.from,
                        params.to,
                        audioBytes,
                        params.isGroup || false
                    );
                    result = { action: "VOICE_NOTE_SENT" };
                    break;
                    
                case 'startCall':
                    await this.chatService.startCall(
                        params.from,
                        params.to,
                        params.isGroup || false
                    );
                    result = { action: "CALL_STARTED" };
                    break;
                    
                case 'getHistory':
                    const messages = await this.chatService.getHistory(
                        params.target,
                        params.fromUser || params.from,
                        params.isGroup || false
                    );
                    // Convertir mensajes Ice a formato JSON
                    result = { 
                        messages: messages.map(msg => this.messageToJson(msg))
                    };
                    break;
                    
                case 'getUsers':
                    const users = await this.chatService.getUsers();
                    result = { users: users };
                    break;
                    
                case 'getGroups':
                    const groups = await this.chatService.getGroups();
                    result = { groups: groups };
                    break;
                    
                default:
                    throw new Error(`Método desconocido: ${method}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ Error en callIceMethod(${method}):`, error);
            
            // Convertir excepciones Ice a errores JavaScript
            if (error.ice_name && error.ice_name === 'Chat::ChatException') {
                throw new Error(error.reason || 'Error del servidor');
            }
            
            throw error;
        }
    }

    // Convertir mensaje Ice a JSON
    messageToJson(msg) {
        // Manejar timestamp (puede ser Ice.Long o número)
        let timestamp;
        if (msg.timestamp) {
            if (typeof msg.timestamp === 'object' && msg.timestamp.high !== undefined) {
                // Ice.Long object - convertir a número
                timestamp = msg.timestamp.high * 0x100000000 + (msg.timestamp.low >>> 0);
            } else if (typeof msg.timestamp === 'string') {
                timestamp = parseInt(msg.timestamp);
            } else {
                timestamp = msg.timestamp;
            }
        } else {
            timestamp = Date.now();
        }
        
        const result = {
            from: msg.from || '',
            to: msg.to || '',
            message: msg.content || '',
            timestamp: timestamp.toString(),
            isGroup: msg.isGroup || false,
            type: msg.type || 'text'
        };
        
        // Si es audio, convertir bytes a Base64
        if (msg.type === 'audio' && msg.data && msg.data.length > 0) {
            try {
                const buffer = Buffer.from(msg.data);
                result.audioData = buffer.toString('base64');
            } catch (e) {
                console.error('Error convirtiendo audio a Base64:', e);
                result.audioData = '';
            }
        }
        
        return result;
    }

    // Cerrar conexión
    async disconnect() {
        if (this.communicator) {
            try {
                await this.communicator.destroy();
                this.connected = false;
                console.log('✅ Desconectado de Ice');
            } catch (error) {
                console.error('❌ Error desconectando:', error);
            }
        }
    }
}

// Implementación del callback Ice para recibir notificaciones
class MessageCallbackI extends Chat.MessageCallback {
    constructor(bridge) {
        super();
        this.bridge = bridge;
    }

    onMessage(msg, current) {
        console.log('🔔 [Ice Callback] onMessage invocado desde servidor');
        console.log('   Mensaje:', msg.from, '->', msg.to, ':', msg.content);
        
        if (this.bridge.messageHandler) {
            try {
                const jsonMsg = this.bridge.messageToJson(msg);
                console.log('   Procesando mensaje y enviando al handler...');
                this.bridge.messageHandler({
                    type: 'newMessage',
                    message: jsonMsg
                });
                console.log('   ✅ Mensaje procesado correctamente');
            } catch (error) {
                console.error('❌ Error procesando mensaje en callback:', error);
                console.error('   Stack:', error.stack);
            }
        } else {
            console.warn('⚠️  No hay messageHandler configurado en el bridge');
        }
    }

    onGroupMessage(msg, groupName, current) {
        console.log('🔔 [Ice Callback] onGroupMessage invocado desde servidor');
        console.log('   Mensaje grupal:', msg.from, '->', groupName, ':', msg.content);
        
        if (this.bridge.messageHandler) {
            try {
                const jsonMsg = this.bridge.messageToJson(msg);
                jsonMsg.to = groupName; // Asegurar que el grupo esté en 'to'
                jsonMsg.isGroup = true;
                console.log('   Procesando mensaje grupal y enviando al handler...');
                this.bridge.messageHandler({
                    type: 'newMessage',
                    message: jsonMsg
                });
                console.log('   ✅ Mensaje grupal procesado correctamente');
            } catch (error) {
                console.error('❌ Error procesando mensaje grupal en callback:', error);
                console.error('   Stack:', error.stack);
            }
        } else {
            console.warn('⚠️  No hay messageHandler configurado en el bridge');
        }
    }
}

module.exports = new IceBridge();
