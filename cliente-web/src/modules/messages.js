import { MessageHandler } from './modules/messages.js';
import { AudioHandler } from './modules/audio.js';
import { WebRTCHandler } from './modules/webrtc.js';
import { UIHandler } from './modules/ui.js';

class ChatApp {
    constructor() {
        this.username = '';
        this.targetUser = '';
        this.isGroupChat = false;
        this.API_URL = 'http://localhost:3000';
        this.WS_URL = 'ws://localhost:3000';
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // Inicializar módulos
        this.ui = new UIHandler(this);
        this.messages = new MessageHandler(this);
        this.audio = new AudioHandler(this);
        this.webrtc = new WebRTCHandler(this);

        this.init();
    }

    init() {
        this.getUsername();
        this.setupEventListeners();
    }

    getUsername() {
        this.username = prompt('Ingresa tu nombre:') || 'Usuario' + Math.floor(Math.random() * 1000);
        document.getElementById('usernameDisplay').textContent = this.username;
        document.getElementById('userAvatar').textContent = this.username[0].toUpperCase();
        document.getElementById('userAvatar').style.backgroundColor = this.ui.getAvatarColor(this.username);
        this.registerUser();
        this.refreshLists();
        this.connectWebSocket();
    }

    async registerUser() {
        try {
            const response = await fetch(`${this.API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.username })
            });
            const result = await response.json();
            console.log('Usuario registrado:', result);
        } catch (err) {
            console.error('Error registrando usuario', err);
        }
    }

    // Conexión WebSocket para mensajes en tiempo real
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket conectado');
                this.reconnectAttempts = 0;

                // Registrar usuario en el WebSocket
                this.ws.send(JSON.stringify({
                    type: 'register',
                    username: this.username
                }));

                this.ui.updateConnectionStatus(true);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📥 [WebSocket] Mensaje recibido:', data.type);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('❌ Error parseando mensaje WebSocket:', e);
                    console.error('   Datos recibidos:', event.data);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket desconectado');
                this.ui.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('Error WebSocket:', error);
                this.ui.updateConnectionStatus(false);
            };

        } catch (error) {
            console.error('Error conectando WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Intentando reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            setTimeout(() => this.connectWebSocket(), 2000 * this.reconnectAttempts);
        } else {
            console.log('Máximo de intentos de reconexión alcanzado');
        }
    }

    handleWebSocketMessage(data) {
        console.log('Mensaje WebSocket recibido:', data);

        switch (data.type) {
            case 'registered':
                console.log('Registrado en WebSocket como:', data.username);
                break;

            case 'newMessage':
                this.messages.handleNewMessage(data.message);
                break;

            case 'groupCreated':
                console.log('Nuevo grupo creado:', data.groupName);
                this.loadGroups();
                break;

            case 'userRegistered':
                console.log('Nuevo usuario registrado:', data.username);
                // Actualizar lista de usuarios cuando alguien nuevo se conecta
                this.loadUsers();
                break;

            case 'userDisconnected':
                console.log('Usuario desconectado:', data.username);
                // Actualizar lista de usuarios cuando alguien se desconecta
                this.loadUsers();
                break;

            case 'incomingCall':
                // Legacy - no se usa
                console.log('handleIncomingCall (legacy):', data);
                break;

            // === WebRTC Signaling ===
            case 'call-offer':
                this.webrtc.handleCallOffer(data);
                break;

            case 'call-answer':
                this.webrtc.handleCallAnswer(data);
                break;

            case 'ice-candidate':
                this.webrtc.handleRemoteIceCandidate(data);
                break;

            case 'call-rejected':
                this.webrtc.handleCallRejected(data);
                break;

            case 'call-ended':
                this.webrtc.handleCallEnded(data);
                break;

            case 'call-failed':
                this.webrtc.handleCallFailed(data);
                break;

            default:
                console.log('Tipo de mensaje no reconocido:', data.type);
        }
    }

    // Métodos delegados a módulos
    async sendMessage() {
        return this.messages.sendMessage();
    }

    async sendVoiceNote() {
        return this.audio.sendVoiceNote();
    }

    stopRecording() {
        return this.audio.stopRecording();
    }

    async startCall() {
        return this.webrtc.startCall();
    }

    endCall() {
        return this.webrtc.endCall();
    }

    async createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();

        console.log('createGroup interno llamado, nombre:', groupName);

        if (groupName) {
            // Agregar grupo inmediatamente a la lista (optimistic update)
            this.ui.addGroupToList(groupName);
            groupInput.value = '';

            try {
                const response = await fetch(`${this.API_URL}/createGroup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupName })
                });
                const result = await response.json();
                console.log('Grupo creado, respuesta:', result);
                // El callback 'groupCreated' actualizará la lista si es necesario
            } catch (error) {
                console.error('Error creando grupo:', error);
                alert('Error al crear grupo: ' + error.message);
                // Remover el grupo de la lista si falla
                this.ui.removeGroupFromList(groupName);
            }
        } else {
            alert('Por favor ingresa un nombre para el grupo');
        }
    }

    selectUser(user) {
        if (user === this.username) return;
        this.targetUser = user;
        this.isGroupChat = false;
        this.ui.updateChatInterface();
        this.messages.loadHistory(user);
    }

    selectGroup(group) {
        this.targetUser = group;
        this.isGroupChat = true;
        this.ui.updateChatInterface();
        this.messages.loadHistory(group);
    }

    async loadHistory(target) {
        return this.messages.loadHistory(target);
    }

    async refreshLists() {
        await this.loadGroups();
        await this.loadUsers();
    }

    async loadGroups() {
        try {
            const response = await fetch(`${this.API_URL}/getGroups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await response.json();
            let groups = [];
            if (result && result.groups) {
                groups = result.groups;
            } else if (result && Array.isArray(result)) {
                groups = result;
            }
            this.ui.updateGroupList(groups);
        } catch (error) {
            console.error('Error cargando grupos:', error);
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.API_URL}/getUsers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await response.json();
            let users = [];
            if (result && result.users) {
                users = result.users;
            } else if (result && Array.isArray(result)) {
                users = result;
            }
            // Filtrar el usuario actual
            users = users.filter(user => user !== this.username);
            this.ui.updateUserList(users);
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('messageInput').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Actualizar lista de usuarios periódicamente (cada 10 segundos)
        setInterval(() => {
            this.loadUsers();
        }, 10000);
    }

    // Getters para compatibilidad con módulos
    get isRecording() {
        return this.audio.isRecording;
    }

    get isInCall() {
        return this.webrtc.isInCall;
    }
}

// Inicializar la aplicación y exponer funciones globalmente
let chatApp;

window.onload = () => {
    chatApp = new ChatApp();
};

// Exponer funciones al objeto window para que sean accesibles desde el HTML
window.sendMessage = function() {
    console.log('sendMessage llamado');
    if (chatApp) chatApp.sendMessage();
    else console.error('chatApp no inicializado');
};

window.createGroup = function() {
    console.log('createGroup llamado');
    if (chatApp) chatApp.createGroup();
    else console.error('chatApp no inicializado');
};

window.sendVoiceNote = function() {
    console.log('sendVoiceNote llamado, isRecording:', chatApp?.isRecording);
    if (!chatApp) {
        console.error('chatApp no inicializado');
        return;
    }
    if (chatApp.isRecording) {
        chatApp.stopRecording();
    } else {
        chatApp.sendVoiceNote();
    }
};

window.startCall = function() {
    console.log('startCall llamado');
    if (chatApp) {
        if (chatApp.isInCall) {
            chatApp.endCall();
        } else {
            chatApp.startCall();
        }
    } else {
        console.error('chatApp no inicializado');
    }
};