// Cliente Ice para comunicación con el servidor
import Ice from 'ice';

// Importar las definiciones generadas de Ice
// Nota: Estas se generarán con slice2js desde el archivo Chat.ice
// Por ahora, definimos las interfaces manualmente para el cliente

export class IceChatClient {
    constructor() {
        this.communicator = null;
        this.chatService = null;
        this.callback = null;
        this.username = null;
    }

    async initialize(username) {
        try {
            this.username = username;
            
            // Inicializar Ice
            const properties = Ice.createProperties();
            properties.setProperty('Ice.Default.Locator', '');
            
            const initData = new Ice.InitializationData();
            initData.properties = properties;
            
            this.communicator = Ice.initialize(initData);
            
            // Conectar al servidor usando WebSocket
            const proxy = this.communicator.stringToProxy(`ChatService:ws -h localhost -p 10000`);
            this.chatService = await Chat.ChatServicePrx.checkedCast(proxy);
            
            if (!this.chatService) {
                throw new Error('Proxy inválido');
            }
            
            console.log('Conectado al servidor Ice');
            return true;
        } catch (error) {
            console.error('Error inicializando cliente Ice:', error);
            throw error;
        }
    }

    async registerUser(username) {
        try {
            await this.chatService.registerUser(username);
            console.log('Usuario registrado:', username);
        } catch (error) {
            console.error('Error registrando usuario:', error);
            throw error;
        }
    }

    async createGroup(groupName) {
        try {
            await this.chatService.createGroup(groupName);
            console.log('Grupo creado:', groupName);
        } catch (error) {
            console.error('Error creando grupo:', error);
            throw error;
        }
    }

    async sendMessage(from, to, message, isGroup) {
        try {
            await this.chatService.sendMessage(from, to, message, isGroup);
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            throw error;
        }
    }

    async sendAudio(from, to, audioData, isGroup) {
        try {
            // Convertir ArrayBuffer a byte array
            const bytes = new Uint8Array(audioData);
            await this.chatService.sendAudio(from, to, bytes, isGroup);
        } catch (error) {
            console.error('Error enviando nota de voz:', error);
            throw error;
        }
    }

    async startCall(from, to, isGroup) {
        try {
            await this.chatService.startCall(from, to, isGroup);
        } catch (error) {
            console.error('Error iniciando llamada:', error);
            throw error;
        }
    }

    async getHistory(target, fromUser, isGroup) {
        try {
            const messages = await this.chatService.getHistory(target, fromUser, isGroup);
            return messages;
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            throw error;
        }
    }

    async getUsers() {
        try {
            const users = await this.chatService.getUsers();
            return users;
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            throw error;
        }
    }

    async getGroups() {
        try {
            const groups = await this.chatService.getGroups();
            return groups;
        } catch (error) {
            console.error('Error obteniendo grupos:', error);
            throw error;
        }
    }

    async subscribe(callback) {
        try {
            // Crear callback object
            const adapter = this.communicator.createObjectAdapter('');
            const callbackImpl = new MessageCallbackI(callback);
            const callbackPrx = adapter.addWithUUID(callbackImpl);
            adapter.activate();
            
            this.callback = callbackPrx;
            await this.chatService.subscribe(callbackPrx, this.username);
            console.log('Suscripto a notificaciones en tiempo real');
        } catch (error) {
            console.error('Error suscribiéndose:', error);
            throw error;
        }
    }

    async unsubscribe() {
        try {
            if (this.callback && this.username) {
                await this.chatService.unsubscribe(this.username);
                this.callback = null;
            }
        } catch (error) {
            console.error('Error desuscribiéndose:', error);
        }
    }

    destroy() {
        if (this.communicator) {
            this.communicator.destroy();
        }
    }
}

// Implementación del callback para recibir notificaciones
class MessageCallbackI extends Chat.MessageCallback {
    constructor(callback) {
        super();
        this.callback = callback;
    }

    onMessage(msg, current) {
        if (this.callback && this.callback.onMessage) {
            this.callback.onMessage(msg);
        }
    }

    onGroupMessage(msg, groupName, current) {
        if (this.callback && this.callback.onGroupMessage) {
            this.callback.onGroupMessage(msg, groupName);
        }
    }
}

