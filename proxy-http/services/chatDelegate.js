const Ice = require('ice').Ice;

let communicator = null;
let chatMaster = null;
let chatWorker = null;
let currentWorkerId = null;
let updateCallback = null;

// Implementación del Worker
class ChatWorkerI extends Chat.ChatWorker {
    deliverMessage(msg, current) {
        if (updateCallback) {
            const messageData = {
                action: 'MESSAGE',
                message: {
                    from: msg.from,
                    to: msg.to,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    isGroup: msg.isGroup
                }
            };
            console.log("📨 Mensaje recibido via Ice:", messageData);
            updateCallback(JSON.stringify(messageData));
        }
    }

    updateUserList(users, current) {
        if (updateCallback) {
            const userListData = {
                action: 'USER_LIST',
                users: users
            };
            console.log("👥 Lista de usuarios actualizada:", users);
            updateCallback(JSON.stringify(userListData));
        }
    }

    updateGroupList(groups, current) {
        if (updateCallback) {
            const groupListData = {
                action: 'GROUP_LIST', 
                groups: groups
            };
            console.log("👥 Lista de grupos actualizada:", groups);
            updateCallback(JSON.stringify(groupListData));
        }
    }
}

// Inicializar conexión Ice
async function initializeIce(callback) {
    updateCallback = callback;
    try {
        if (communicator) {
            console.log("✅ Ice ya inicializado");
            return true;
        }

        console.log("🔄 Inicializando Ice...");
        communicator = Ice.initialize();
        
        // Conectar al Master
        console.log("🔗 Conectando a ChatMaster...");
        const masterBase = communicator.stringToProxy("ChatMaster:ws -h localhost -p 10000");
        chatMaster = await Chat.ChatMasterPrx.checkedCast(masterBase);
        
        if (!chatMaster) {
            throw new Error("No se pudo conectar al ChatMaster");
        }
        
        // Registrar este Worker
        currentWorkerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log("👷 Registrando worker:", currentWorkerId);
        const adapter = communicator.createObjectAdapterWithEndpoints("ChatWorker", "ws");
        chatWorker = new ChatWorkerI();
        const workerPrx = Chat.ChatWorkerPrx.uncheckedCast(adapter.addWithUUID(chatWorker));
        adapter.activate();
        
        await chatMaster.registerWorker(currentWorkerId, workerPrx);
        
        console.log("✅ Worker Ice registrado exitosamente:", currentWorkerId);
        return true;
    } catch (ex) {
        console.error("❌ Error inicializando Ice:", ex);
        if (communicator) {
            try {
                communicator.destroy();
            } catch (e) {}
            communicator = null;
        }
        return false;
    }
}

// Función principal modificada
async function sendToChatServer(json) {
    try {
        if (!chatMaster) {
            const initialized = await initializeIce(() => {});
            if (!initialized) {
                throw new Error("No se pudo inicializar Ice");
            }
        }

        const data = JSON.parse(json);
        console.log("📤 Enviando acción:", data.action);
        
        switch(data.action) {
            case 'REGISTER':
                await chatMaster.registerUser(data.username, currentWorkerId);
                return JSON.stringify({action: 'REGISTERED', username: data.username});
                
            case 'CREATE_GROUP':
                await chatMaster.createGroup(data.groupName, currentWorkerId);
                return JSON.stringify({action: 'GROUP_CREATED', groupName: data.groupName});
                
            case 'SEND_MESSAGE':
                const iceMsg = new Chat.Message(
                    data.from, 
                    data.to, 
                    data.message, 
                    new Date().toString(), 
                    data.isGroup === true
                );
                await chatMaster.sendMessage(iceMsg);
                return JSON.stringify({action: 'MESSAGE_SENT'});
                
            case 'GET_USERS':
                const users = await chatMaster.getUsers();
                return JSON.stringify({users: users});
                
            case 'GET_GROUPS':
                const groups = await chatMaster.getGroups();
                return JSON.stringify({action: 'GROUP_LIST', groups: groups});
                
            case 'GET_HISTORY':
                const history = await chatMaster.getHistory(data.target, data.from, data.isGroup === true);
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
                return JSON.stringify({error: 'Acción no reconocida: ' + data.action});
        }
    } catch (ex) {
        console.error('❌ Error en comunicación Ice:', ex);
        const errorMsg = ex.reason || ex.message || ex.toString();
        return JSON.stringify({error: errorMsg});
    }
}

module.exports = { sendToChatServer, initializeIce };