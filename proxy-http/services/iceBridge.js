// Bridge para convertir llamadas HTTP a Ice RPC
// Nota: En una implementación completa, esto usaría el cliente Ice de Node.js
// Por ahora, creamos un bridge que se comunica con el servidor Java

class IceBridge {
    constructor() {
        // El bridge se comunica con el servidor Java vía TCP socket
    }

    async callIceMethod(method, params) {
        // Por ahora, usamos el servidor Java original como fallback
        // En una implementación completa, esto haría llamadas RPC directas a Ice
        // usando el cliente Ice de Node.js
        
        // Convertir la llamada Ice a formato JSON para el servidor
        const actionMap = {
            'registerUser': 'REGISTER',
            'createGroup': 'CREATE_GROUP',
            'sendMessage': 'SEND_MESSAGE',
            'sendAudio': 'SEND_VOICE_NOTE',
            'sendVoiceNote': 'SEND_VOICE_NOTE', // Alias para compatibilidad
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
            case 'sendVoiceNote':
                // Para notas de voz, necesitamos enviar los datos de audio
                jsonPayload = { 
                    action, 
                    from: params.from, 
                    to: params.to, 
                    isGroup: params.isGroup,
                    audioData: params.audioData || params.data
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
                    from: params.fromUser, 
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

        // Llamar al servidor Java (que ahora puede ser el servidor Ice)
        const net = require('net');
        const SERVER_HOST = 'localhost';
        const SERVER_PORT = 5000; // Puerto del servidor Java original
        
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            let data = '';

            client.connect(SERVER_PORT, SERVER_HOST, () => {
                client.write(JSON.stringify(jsonPayload) + '\n');
            });

            client.on('data', chunk => {
                data += chunk.toString();
                if (data.includes('\n')) {
                    try {
                        const response = JSON.parse(data.trim());
                        // Convertir respuesta al formato esperado por el frontend
                        resolve(this.formatResponse(method, response));
                    } catch (e) {
                        resolve({ success: true, data: data.trim() });
                    }
                    client.end();
                }
            });

            client.on('error', err => {
                reject(err);
            });

            // Timeout
            setTimeout(() => {
                if (!client.destroyed) {
                    client.destroy();
                    reject(new Error('Timeout en llamada Ice'));
                }
            }, 10000);
        });
    }

    formatResponse(method, response) {
        switch (method) {
            case 'getHistory':
                // Convertir mensajes del formato del servidor al formato esperado
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

