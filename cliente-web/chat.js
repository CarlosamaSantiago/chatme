class ChatApp {
    constructor() {
        this.username = '';
        this.targetUser = '';
        this.isGroupChat = false;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        this.API_URL = 'http://localhost:3000';
        this.pollingInterval = null;

        // WebSocket para notas de voz
        this.ws = null;

        // Grabación de audio
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.lastRecordedBlob = null;

        this.init();
    }

    init() {
        this.getUsername();
        this.setupEventListeners();
        this.initWebSocket();
        setInterval(() => this.refreshLists(), 5000); // cada 5 segs
    }

    initWebSocket() {
        try {
            this.ws = new WebSocket('ws://localhost:3000/ws');
            this.ws.onopen = () => console.log('WebSocket conectado');
            this.ws.onmessage = (event) => {
                console.log('WS respuesta:', event.data);
                // Podrías procesar aquí la respuesta si quieres
            };
            this.ws.onclose = () => console.log('WebSocket cerrado');
            this.ws.onerror = (err) => console.error('WS error:', err);
        } catch (err) {
            console.error('Error al crear WebSocket:', err);
        }
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

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message && this.targetUser) {
            try {
                await fetch(`${this.API_URL}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: this.username,
                        to: this.targetUser,
                        message: message,
                        isGroup: this.isGroupChat
                    })
                });

                this.displayMessage({
                    from: this.username,
                    to: this.targetUser,
                    message: message,
                    timestamp: new Date().toString(),
                    isGroup: this.isGroupChat
                });

                messageInput.value = '';
                setTimeout(() => this.loadHistory(this.targetUser), 500);
            } catch (error) {
                console.error('Error enviando mensaje:', error);
                alert('Error al enviar mensaje');
            }
        }
    }

    // ======= NOTAS DE VOZ =======

    async startRecordingVoice() {
        if (!this.targetUser) {
            alert('Selecciona un chat primero');
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Tu navegador no soporta grabación de audio');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                // juntar TODOS los chunks
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                this.lastRecordedBlob = blob;

                console.log('[FRONT] Blob de voz listo. Tamaño:', blob.size, 'bytes');

                // cerrar micrófono
                stream.getTracks().forEach(t => t.stop());

                document.getElementById('btnStartVoice').disabled = false;
                document.getElementById('btnStopVoice').disabled = true;
                document.getElementById('btnSendVoice').disabled = false;
            };

            this.mediaRecorder.start();
            document.getElementById('btnStartVoice').disabled = true;
            document.getElementById('btnStopVoice').disabled = false;
            document.getElementById('btnSendVoice').disabled = true;

        } catch (err) {
            console.error('Error al iniciar grabación', err);
            alert('No se pudo acceder al micrófono');
        }
    }

    stopRecordingVoice() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async sendVoiceMessage() {
        if (!this.lastRecordedBlob) {
            alert('Primero graba una nota de voz');
            return;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Conexión de WebSocket no disponible');
            return;
        }

        try {
            const base64 = await this.blobToBase64(this.lastRecordedBlob);
            console.log('[FRONT] Enviando nota de voz. base64 length =', base64.length);
            const payload = {
                action: 'SEND_VOICE',
                from: this.username,
                to: this.targetUser,
                isGroup: this.isGroupChat,
                audioBase64: base64,
                extension: 'webm'
            };
            this.ws.send(JSON.stringify(payload));

            // Después de enviar, limpiamos
            this.lastRecordedBlob = null;
            document.getElementById('btnSendVoice').disabled = true;

            // El historial se actualizará solo por polling
        } catch (err) {
            console.error('Error enviando nota de voz:', err);
            alert('Error al enviar nota de voz');
        }
    }

    async createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();

        if (groupName) {
            try {
                await fetch(`${this.API_URL}/createGroup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupName })
                });

                alert(`Grupo creado: ${groupName}`);
                groupInput.value = '';
                this.loadGroups();
            } catch (error) {
                console.error('Error creando grupo:', error);
            }
        }
    }

    selectUser(user) {
        if (user === this.username) return;
        this.targetUser = user;
        this.isGroupChat = false;
        this.updateChatInterface();
        this.loadHistory(user);
        this.startPolling();
    }

    selectGroup(group) {
        this.targetUser = group;
        this.isGroupChat = true;
        this.updateChatInterface();
        this.loadHistory(group);
        this.startPolling();
    }

    async loadHistory(target) {
        try {
            const response = await fetch(`${this.API_URL}/getHistory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    from: this.username,
                    isGroup: this.isGroupChat
                })
            });
            const result = await response.json();
            if (result.messages) this.displayHistory(result.messages);
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    }

    startPolling() {
        this.stopPolling();
        this.pollingInterval = setInterval(() => {
            if (this.targetUser) this.loadHistory(this.targetUser);
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
            const response = await fetch(`${this.API_URL}/getGroups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const result = await response.json();
            if (result.groups) this.updateGroupList(result.groups);
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
            if (result.users) this.updateUserList(result.users);
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

        // 👉 NO actualizar el historial si hay un audio reproduciéndose
        const anyPlaying = Array
            .from(container.querySelectorAll('audio'))
            .some(a => !a.paused && !a.ended);

        if (anyPlaying) {
            // Si hay alguna nota sonando, no tocamos nada
            return;
        }

        // Si no hay audios sonando, sí refrescamos normalmente
        container.innerHTML = '';
        if (Array.isArray(messages)) {
            messages.forEach(m => {
                let msgData = typeof m === 'string' ? JSON.parse(m) : m;
                container.appendChild(this.createMessageElement(msgData));
            });
        }
        container.scrollTop = container.scrollHeight;
    }


    createMessageElement(m) {
        const own = m.from === this.username;
        const isVoice = typeof m.message === 'string' && m.message.startsWith('__VOICE__:');
        let audioUrl = null;
        if (isVoice) {
            const audioPath = m.message.replace('__VOICE__:', '');
            // Si ya viene con http, la dejamos; si no, le pegamos el API_URL (http://localhost:3000)
            audioUrl = audioPath.startsWith('http')
                ? audioPath
                : `${this.API_URL}${audioPath}`;
        }
        const timestamp = m.timestamp || new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = `message ${own ? 'right' : 'left'}`;

        const avatarColor = this.getAvatarColor(m.from || '?');
        const fromInitial = (m.from || '?')[0].toUpperCase();

        let messageContent;
        if (isVoice) {
            messageContent = `<audio controls src="${audioUrl}"></audio>`;
        } else {
            messageContent = this.escapeHtml(m.message || '');
        }

        div.innerHTML = `
            <div class="avatar" style="background-color:${avatarColor}">
                ${fromInitial}
            </div>
            <div class="text-wrapper">
                ${!own ? `<div class="user-name">${this.escapeHtml(m.from)}</div>` : ''}
                <div class="text">${messageContent}</div>
                <div class="timestamp">${timestamp}</div>
            </div>
        `;
        return div;
    }

    updateChatInterface() {
        document.getElementById('chatTarget').textContent = this.targetUser || 'Selecciona un chat';
        document.getElementById('groupBadge').style.display = this.isGroupChat ? 'inline-block' : 'none';

        const inputWrapper = document.getElementById('messageInputWrapper');
        const btnStart = document.getElementById('btnStartVoice');
        const btnStop = document.getElementById('btnStopVoice');
        const btnSend = document.getElementById('btnSendVoice');

        if (this.targetUser) {
            inputWrapper.style.display = 'flex';
            btnStart.disabled = false;
            btnStop.disabled = true;
            btnSend.disabled = true;
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

        document.getElementById('btnStartVoice').addEventListener('click', () => this.startRecordingVoice());
        document.getElementById('btnStopVoice').addEventListener('click', () => this.stopRecordingVoice());
        document.getElementById('btnSendVoice').addEventListener('click', () => this.sendVoiceMessage());
    }
}

let chatApp;
window.onload = () => { chatApp = new ChatApp(); };
function sendMessage() { chatApp.sendMessage(); }
function createGroup() { chatApp.createGroup(); }
