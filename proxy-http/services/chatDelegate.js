const Ice = require('ice').Ice;

// Variables globales para Ice
let communicator = null;
let chatService = null;

// Inicializar conexión Ice
async function initializeIce() {
    try {
        if (communicator) return true;
        
        communicator = Ice.initialize();
        const base = communicator.stringToProxy("ChatService:ws -h localhost -p 10000");
        chatService = await Chat.ChatServicePrx.checkedCast(base);
        console.log("✅ Conexión Ice WebSocket establecida");
        return true;
    } catch (ex) {
        console.error("❌ Error conectando con Ice:", ex);
        return false;
    }
}

// Función principal modificada
async function sendToChatServer(json) {
    try {
        // Inicializar Ice si no está listo
        if (!chatService) {
            const connected = await initializeIce();
            if (!connected) {
                throw new Error("No se pudo conectar al servidor Ice");
            }
        }

        const data = JSON.parse(json);
        
        switch(data.action) {
            case 'REGISTER':
                await chatService.register(data.username);
                return JSON.stringify({action: 'REGISTERED', username: data.username});
                
            case 'CREATE_GROUP':
                await chatService.createGroup(data.groupName);
                return JSON.stringify({action: 'GROUP_CREATED', groupName: data.groupName});
                
            case 'SEND_MESSAGE':
                await chatService.sendMessage(data.from, data.to, data.message, data.isGroup === true);
                return JSON.stringify({action: 'MESSAGE_SENT'});
                
            case 'GET_USERS':
                const users = await chatService.getUsers();
                return JSON.stringify({users: users});
                
            case 'GET_GROUPS':
            case 'LIST_GROUPS':
                const groups = await chatService.getGroups();
                return JSON.stringify({action: 'GROUP_LIST', groups: groups});
                
            case 'GET_HISTORY':
                const history = await chatService.getHistory(data.target, data.from, data.isGroup === true);
                // Convertir de Message[] a JSON strings
                const messages = history.map(msg => 
                    JSON.stringify({
                        from: msg.from,
                        to: msg.to,
                        message: msg.message,
                        timestamp: msg.timestamp,
                        isGroup: msg.isGroup
                    })
                );
                return JSON.stringify({action: 'HISTORY', messages: messages});
                
            default:
                return JSON.stringify({error: 'Acción no reconocida'});
        }
    } catch (ex) {
        console.error('❌ Error en comunicación Ice:', ex);
        const errorMsg = ex.reason || ex.message || ex.toString();
        return JSON.stringify({error: errorMsg});
    }
}

module.exports = { sendToChatServer, initializeIce };