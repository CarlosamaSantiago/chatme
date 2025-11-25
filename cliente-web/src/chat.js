class ChatApp {
    constructor() {
        this.username = '';
        this.targetUser = '';
        this.isGroupChat = false;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        this.ICE_WS_URL = 'ws://localhost:10000';
        this.ws = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isInCall = false;
        this.localStream = null;
        this.remoteStream = null;
        this.pollingInterval = null;

        this.init();
    }

    init() {
        this.getUsername();
        this.setupEventListeners();
        // Usar polling en lugar de WebSocket por ahora
        this.startPollingFallback();
    }

    getUsername() {
        this.username = prompt('Ingresa tu nombre:') || 'Usuario' + Math.floor(Math.random() * 1000);
        document.getElementById('usernameDisplay').textContent = this.username;
        document.getElementById('userAvatar').textContent = this.username[0].toUpperCase();
        document.getElementById('userAvatar').style.backgroundColor = this.getAvatarColor(this.username);
        this.refreshLists();
        this.registerUser();
    }

    async registerUser() {
        try {
            // Usar Ice RPC para registrar usuario
            const response = await this.callIceRPC('registerUser', { username: this.username });
            console.log('Usuario registrado:', response);
        } catch (err) {
            console.error('Error registrando usuario', err);
        }
    }

    async callIceRPC(method, params) {
        // Mapear métodos Ice a endpoints HTTP del proxy
        const endpointMap = {
            'registerUser': '/register',
            'createGroup': '/createGroup',
            'sendMessage': '/sendMessage',
            'sendAudio': '/sendMessage', // Por ahora usar sendMessage
            'startCall': '/sendMessage', // Por ahora usar sendMessage
            'getHistory': '/getHistory',
            'getUsers': '/getUsers',
            'getGroups': '/getGroups'
        };
        
        const endpoint = endpointMap[method] || '/ice/' + method;
        
        try {
            // Adaptar parámetros según el endpoint
            let body = params;
            if (method === 'sendMessage') {
                body = {
                    from: params.from,
                    to: params.to,
                    message: params.message || params.content,
                    isGroup: params.isGroup
                };
            } else if (method === 'getHistory') {
                body = {
                    target: params.target,
                    from: params.fromUser,
                    isGroup: params.isGroup
                };
            }
            
            const response = await fetch('http://localhost:3000' + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                throw new Error(errorData.error || 'Error en la llamada');
            }
            return await response.json();
        } catch (error) {
            console.error('Error en llamada:', error);
            throw error;
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message && this.targetUser) {
            try {
                await this.callIceRPC('sendMessage', {
                    from: this.username,
                    to: this.targetUser,
                    message: message,
                    isGroup: this.isGroupChat
                });

                // No mostrar el mensaje inmediatamente, esperar a que se cargue del servidor
                messageInput.value = '';
                
                // Recargar historial después de un breve delay
                setTimeout(() => {
                    this.loadHistory(this.targetUser);
                }, 300);
            } catch (error) {
                console.error('Error enviando mensaje:', error);
                alert('Error al enviar mensaje: ' + error.message);
            }
        }
    }

    async sendVoiceNote() {
        if (!this.targetUser) {
            alert('Selecciona un destinatario primero');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);

                try {
                    await this.callIceRPC('sendAudio', {
                        from: this.username,
                        to: this.targetUser,
                        isGroup: this.isGroupChat,
                        data: Array.from(bytes)
                    });

                    this.displayMessage({
                        from: this.username,
                        to: this.targetUser,
                        message: '[Nota de voz]',
                        type: 'audio',
                        audioData: bytes,
                        timestamp: new Date().toISOString()
                    });

                    // Detener el stream
                    stream.getTracks().forEach(track => track.stop());
                } catch (error) {
                    console.error('Error enviando nota de voz:', error);
                    alert('Error al enviar nota de voz');
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateRecordingUI(true);

            // Detener después de 10 segundos o cuando el usuario haga clic de nuevo
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, 10000);

        } catch (error) {
            console.error('Error accediendo al micrófono:', error);
            alert('Error al acceder al micrófono');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    updateRecordingUI(recording) {
        const btn = document.getElementById('voiceNoteBtn');
        if (btn) {
            if (recording) {
                btn.classList.add('recording');
                btn.textContent = '⏹ Detener';
            } else {
                btn.classList.remove('recording');
                btn.textContent = '🎤 Voz';
            }
        }
    }

    async startCall() {
        if (!this.targetUser) {
            alert('Selecciona un destinatario primero');
            return;
        }

        if (this.isInCall) {
            this.endCall();
            return;
        }

        try {
            // Iniciar llamada en el servidor
            await this.callIceRPC('startCall', {
                from: this.username,
                to: this.targetUser,
                isGroup: this.isGroupChat
            });

            // Obtener acceso a cámara y micrófono
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.style.display = 'block';
            }

            this.isInCall = true;
            this.updateCallUI(true);

            // Nota: En una implementación completa, aquí se establecería
            // la conexión WebRTC para la llamada
            this.displayMessage({
                from: this.username,
                to: this.targetUser,
                message: '[Llamada iniciada]',
                type: 'call',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error iniciando llamada:', error);
            alert('Error al iniciar llamada');
        }
    }

    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = null;
            localVideo.style.display = 'none';
        }

        this.isInCall = false;
        this.updateCallUI(false);
    }

    updateCallUI(inCall) {
        const btn = document.getElementById('callBtn');
        if (btn) {
            if (inCall) {
                btn.classList.add('in-call');
                btn.textContent = '📞 Colgar';
            } else {
                btn.classList.remove('in-call');
                btn.textContent = '📞 Llamar';
            }
        }
    }

    async createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();

        if (groupName) {
            try {
                await this.callIceRPC('createGroup', { groupName });
                alert(`Grupo creado: ${groupName}`);
                groupInput.value = '';
                this.loadGroups();
            } catch (error) {
                console.error('Error creando grupo:', error);
                alert('Error al crear grupo');
            }
        }
    }

    selectUser(user) {
        if (user === this.username) return;
        this.targetUser = user;
        this.isGroupChat = false;
        this.updateChatInterface();
        this.loadHistory(user);
    }

    selectGroup(group) {
        this.targetUser = group;
        this.isGroupChat = true;
        this.updateChatInterface();
        this.loadHistory(group);
    }

    async loadHistory(target) {
        try {
            const result = await this.callIceRPC('getHistory', {
                target,
                fromUser: this.username,
                isGroup: this.isGroupChat
            });
            
            // El resultado puede venir en diferentes formatos
            let messages = [];
            if (result && result.messages) {
                messages = result.messages;
            } else if (Array.isArray(result)) {
                messages = result;
            }
            
            this.displayHistory(messages);
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    }

    startPollingFallback() {
        // Usar polling para actualizaciones en tiempo real
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        this.pollingInterval = setInterval(() => {
            if (this.targetUser) {
                this.loadHistory(this.targetUser);
            }
            this.refreshLists();
        }, 2000);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    async refreshLists() {
        await this.loadGroups();
        await this.loadUsers();
    }

    async loadGroups() {
        try {
            const result = await this.callIceRPC('getGroups', {});
            let groups = [];
            if (result && result.groups) {
                groups = result.groups;
            } else if (result && Array.isArray(result)) {
                groups = result;
            } else if (result && result.action === 'GROUP_LIST' && result.groups) {
                groups = result.groups;
            }
            this.updateGroupList(groups);
        } catch (error) {
            console.error('Error cargando grupos:', error);
        }
    }

    async loadUsers() {
        try {
            const result = await this.callIceRPC('getUsers', {});
            let users = [];
            if (result && result.users) {
                users = result.users;
            } else if (result && Array.isArray(result)) {
                users = result;
            }
            this.updateUserList(users);
        } catch (error) {
            console.error('Error cargando usuarios:', error);
        }
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        users.forEach(user => {
            if (user !== this.username) {
                const el = document.createElement('div');
                el.className = 'user-item';
                el.innerHTML = `
                    <div class="avatar" style="background-color: ${this.getAvatarColor(user)}">
                        ${user[0].toUpperCase()}
                    </div>
                    <span>${user}</span>
                `;
                el.onclick = () => this.selectUser(user);
                usersList.appendChild(el);
            }
        });
    }

    updateGroupList(groups) {
        const groupsList = document.getElementById('groupsList');
        groupsList.innerHTML = '';
        if (!groups || groups.length === 0) {
            groupsList.innerHTML = '<p style="color:#95a5a6;font-size:12px;padding:10px;">No hay grupos</p>';
            return;
        }
        groups.forEach(group => {
            const el = document.createElement('div');
            el.className = 'group-item';
            el.innerHTML = `<div class="group-avatar">#</div><span>${group}</span>`;
            el.onclick = () => this.selectGroup(group);
            groupsList.appendChild(el);
        });
    }

    displayMessage(msg) {
        const container = document.getElementById('messagesContainer');
        container.appendChild(this.createMessageElement(msg));
        container.scrollTop = container.scrollHeight;
    }

    displayHistory(messages) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        if (Array.isArray(messages) && messages.length > 0) {
            messages.forEach(m => {
                try {
                    let msgData = typeof m === 'string' ? JSON.parse(m) : m;
                    if (msgData && msgData.from) {
                        container.appendChild(this.createMessageElement(msgData));
                    }
                } catch (e) {
                    console.error('Error parseando mensaje:', e, m);
                }
            });
        }
        container.scrollTop = container.scrollHeight;
    }

    createMessageElement(m) {
        const own = m.from === this.username;
        const div = document.createElement('div');
        div.className = `message ${own ? 'right' : 'left'}`;
        
        let content = '';
        if (m.type === 'audio') {
            content = `
                <div class="audio-message">
                    <audio controls>
                        <source src="data:audio/webm;base64,${this.arrayBufferToBase64(m.audioData)}" type="audio/webm">
                    </audio>
                </div>
            `;
        } else if (m.type === 'call') {
            content = `<div class="call-message">📞 ${this.escapeHtml(m.message)}</div>`;
        } else {
            content = `<div class="text">${this.escapeHtml(m.message || m.content)}</div>`;
        }
        
        div.innerHTML = `
            <div class="avatar" style="background-color:${this.getAvatarColor(m.from)}">
                ${m.from[0].toUpperCase()}
            </div>
            <div class="text-wrapper">
                ${!own ? `<div class="user-name">${this.escapeHtml(m.from)}</div>` : ''}
                ${content}
                <div class="timestamp">${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}</div>
            </div>`;
        return div;
    }

    arrayBufferToBase64(buffer) {
        if (!buffer) return '';
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    updateChatInterface() {
        document.getElementById('chatTarget').textContent = this.targetUser;
        document.getElementById('groupBadge').style.display = this.isGroupChat ? 'inline-block' : 'none';

        const inputWrapper = document.getElementById('messageInputWrapper');
        if (this.targetUser) {
            inputWrapper.style.display = 'flex';
        } else {
            inputWrapper.style.display = 'none';
        }
    }

    getAvatarColor(u) {
        return this.colors[u.charCodeAt(0) % this.colors.length];
    }

    escapeHtml(t) {
        const div = document.createElement('div');
        div.textContent = t;
        return div.innerHTML;
    }

    setupEventListeners() {
        document.getElementById('messageInput').addEventListener('keypress', e => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }
}

let chatApp;
window.onload = () => { chatApp = new ChatApp(); };
function sendMessage() { chatApp.sendMessage(); }
function createGroup() { chatApp.createGroup(); }
function sendVoiceNote() { 
    if (chatApp.isRecording) {
        chatApp.stopRecording();
    } else {
        chatApp.sendVoiceNote();
    }
}
function startCall() { chatApp.startCall(); }

