// Bridge para convertir llamadas HTTP a Ice RPC
// Se comunica con el servidor Java via TCP socket

class IceBridge {
    constructor() {
        this.SERVER_HOST = 'localhost';
        this.SERVER_PORT = 5000;
    }

    async callIceMethod(method, params) {
        // Convertir la llamada Ice a formato JSON para el servidor
        const actionMap = {
            'registerUser': 'REGISTER',
            'createGroup': 'CREATE_GROUP',
            'sendMessage': 'SEND_MESSAGE',
            'sendAudio': 'SEND_AUDIO',
            'sendVoiceNote': 'SEND_VOICE_NOTE',
            'startCall': 'START_CALL',
            'getHistory': 'GET_HISTORY',
            'getUsers': 'GET_USERS',
            'getGroups': 'GET_GROUPS'
        };

        const action = actionMap[method] || method.toUpperCase();
        
        // Formatear parámetros según el formato esperado por el servidor
        let jsonPayload = {};
        
        switch (method) {
            case 'registerUser':
                jsonPayload = { action, username: params.username };
                break;
            case 'createGroup':
                jsonPayload = { action, groupName: params.groupName };
                break;
            case 'sendMessage':
                jsonPayload = { 
                    action, 
                    from: params.from, 
                    to: params.to, 
                    message: params.message, 
                    isGroup: params.isGroup 
                };
                break;
            case 'sendAudio':
                // Para sendAudio (interfaz ICE), orden: from, to, data, isGroup
                let audioDataIce = params.data || params.audioData;
                if (Array.isArray(audioDataIce)) {
                    const bytes = new Uint8Array(audioDataIce);
                    audioDataIce = Buffer.from(bytes).toString('base64');
                }
                jsonPayload = { 
                    action: 'SEND_AUDIO', 
                    from: params.from, 
                    to: params.to, 
                    audioData: audioDataIce,
                    isGroup: params.isGroup
                };
                break;
            case 'sendVoiceNote':
                // Para sendVoiceNote (endpoint HTTP), orden: from, to, audioData, isGroup
                let audioData = params.audioData || params.data;
                if (Array.isArray(audioData)) {
                    const bytes = new Uint8Array(audioData);
                    audioData = Buffer.from(bytes).toString('base64');
                }
                jsonPayload = { 
                    action: 'SEND_VOICE_NOTE', 
                    from: params.from, 
                    to: params.to, 
                    audioData: audioData,
                    isGroup: params.isGroup
                };
                break;
            case 'startCall':
                jsonPayload = { 
                    action, 
                    from: params.from, 
                    to: params.to, 
                    isGroup: params.isGroup 
                };
                break;
            case 'getHistory':
                jsonPayload = { 
                    action, 
                    target: params.target, 
                    from: params.fromUser || params.from, 
                    isGroup: params.isGroup 
                };
                break;
            case 'getUsers':
                jsonPayload = { action };
                break;
            case 'getGroups':
                jsonPayload = { action };
                break;
            default:
                throw new Error(`Método Ice no soportado: ${method}`);
        }

        return this.sendToServer(jsonPayload, method);
    }

    sendToServer(jsonPayload, method) {
        const net = require('net');
        
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            let data = '';
            let timeoutId;

            client.connect(this.SERVER_PORT, this.SERVER_HOST, () => {
                const payload = JSON.stringify(jsonPayload);
                client.write(payload + '\n');
            });

            client.on('data', chunk => {
                data += chunk.toString();
                if (data.includes('\n')) {
                    clearTimeout(timeoutId);
                    try {
                        const response = JSON.parse(data.trim());
                        resolve(this.formatResponse(method, response));
                    } catch (e) {
                        resolve({ success: true, data: data.trim() });
                    }
                    client.end();
                }
            });

            client.on('error', err => {
                clearTimeout(timeoutId);
                reject(err);
            });

            client.on('close', () => {
                clearTimeout(timeoutId);
            });

            // Timeout de 30 segundos para permitir audio grande
            timeoutId = setTimeout(() => {
                if (!client.destroyed) {
                    client.destroy();
                    reject(new Error('Timeout en llamada Ice'));
                }
            }, 30000);
        });
    }

    formatResponse(method, response) {
        switch (method) {
            case 'getHistory':
                if (response.messages) {
                    return { messages: response.messages };
                }
                return { messages: [] };
            case 'getUsers':
                return { users: response.users || [] };
            case 'getGroups':
                return { groups: response.groups || [] };
            default:
                return { success: true, ...response };
        }
    }
}

module.exports = new IceBridge();
