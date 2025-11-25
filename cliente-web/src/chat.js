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
        this.WS_URL = 'ws://localhost:3000';
        this.ws = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isInCall = false;
        this.localStream = null;
        this.remoteStream = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // === WebRTC ===
        this.peerConnection = null;
        this.currentCallId = null;
        this.pendingCandidates = [];
        this.callPeer = null; // Usuario con el que estamos en llamada
        
        // Configuración de servidores ICE (STUN públicos para NAT traversal)
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };

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
        document.getElementById('userAvatar').style.backgroundColor = this.getAvatarColor(this.username);
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
                
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (e) {
                    console.error('Error parseando mensaje WebSocket:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket desconectado');
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('Error WebSocket:', error);
                this.updateConnectionStatus(false);
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
                this.handleNewMessage(data.message);
                break;

            case 'groupCreated':
                console.log('Nuevo grupo creado:', data.groupName);
                this.loadGroups();
                break;

            case 'incomingCall':
                this.handleIncomingCall(data);
                break;

            // === WebRTC Signaling ===
            case 'call-offer':
                this.handleCallOffer(data);
                break;

            case 'call-answer':
                this.handleCallAnswer(data);
                break;

            case 'ice-candidate':
                this.handleRemoteIceCandidate(data);
                break;

            case 'call-rejected':
                this.handleCallRejected(data);
                break;

            case 'call-ended':
                this.handleCallEnded(data);
                break;

            case 'call-failed':
                this.handleCallFailed(data);
                break;

            default:
                console.log('Tipo de mensaje no reconocido:', data.type);
        }
    }

    handleNewMessage(message) {
        // Verificar si el mensaje es relevante para el chat actual
        const isRelevant = this.isMessageRelevant(message);
        
        if (isRelevant) {
            this.displayMessage(message);
        }
        
        // Mostrar notificación si el mensaje no es del usuario actual
        if (message.from !== this.username) {
            this.showNotification(message);
        }
    }

    isMessageRelevant(message) {
        if (!this.targetUser) return false;
        
        if (message.isGroup) {
            return message.to === this.targetUser;
        } else {
            return (message.from === this.targetUser && message.to === this.username) ||
                   (message.from === this.username && message.to === this.targetUser);
        }
    }

    showNotification(message) {
        // Notificación en el título de la página
        if (document.hidden) {
            document.title = `💬 Nuevo mensaje de ${message.from}`;
            setTimeout(() => {
                document.title = 'Chat App';
            }, 3000);
        }
    }

    handleIncomingCall(data) {
        // Este método ya no se usa directamente - las llamadas WebRTC usan handleCallOffer
        console.log('handleIncomingCall (legacy):', data);
    }

    // === WEBRTC: Recibir oferta de llamada ===
    async handleCallOffer(data) {
        const { from, offer, callId, isGroup } = data;
        console.log(`📞 Oferta de llamada recibida de ${from}`);

        // Si ya estamos en una llamada, rechazar
        if (this.isInCall) {
            this.ws.send(JSON.stringify({
                type: 'call-reject',
                to: from,
                callId: callId
            }));
            return;
        }

        // Mostrar diálogo de aceptar/rechazar
        const accept = confirm(`📞 Llamada entrante de ${from}. ¿Aceptar?`);
        
        if (!accept) {
            this.ws.send(JSON.stringify({
                type: 'call-reject',
                to: from,
                callId: callId
            }));
            return;
        }

        try {
            // Aceptar llamada
            this.callPeer = from;
            this.currentCallId = callId;
            this.targetUser = from;
            this.isGroupChat = isGroup || false;
            this.updateChatInterface();

            // Obtener audio local
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: false 
            });
            console.log('✓ Micrófono activado');

            // Crear PeerConnection
            this.createPeerConnection();

            // Añadir tracks locales
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Establecer oferta remota
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('✓ Oferta remota establecida');

            // Añadir candidatos pendientes
            for (const candidate of this.pendingCandidates) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
            this.pendingCandidates = [];

            // Crear respuesta
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('✓ Respuesta SDP creada');

            // Enviar respuesta
            this.ws.send(JSON.stringify({
                type: 'call-answer',
                to: from,
                answer: answer,
                callId: callId
            }));

            // Iniciar UI de llamada
            this.isInCall = true;
            this.updateCallUI(true);
            this.startCallTimer();
            this.showCallIndicator();

            this.displayMessage({
                from: from,
                to: this.username,
                message: '📞 Llamada conectada',
                type: 'call',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error aceptando llamada:', error);
            alert('Error al aceptar llamada: ' + error.message);
            this.cleanupCall();
        }
    }

    // === WEBRTC: Recibir respuesta de llamada ===
    async handleCallAnswer(data) {
        const { from, answer } = data;
        console.log(`✅ Respuesta de llamada recibida de ${from}`);

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✓ Respuesta remota establecida - Llamada conectada!');

            this.displayMessage({
                from: this.username,
                to: from,
                message: '📞 Llamada conectada',
                type: 'call',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error procesando respuesta:', error);
        }
    }

    // === WEBRTC: Recibir candidato ICE remoto ===
    async handleRemoteIceCandidate(data) {
        const { from, candidate } = data;

        if (!candidate) return;

        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('✓ Candidato ICE añadido');
            } else {
                // Guardar para después
                this.pendingCandidates.push(candidate);
            }
        } catch (error) {
            console.error('Error añadiendo candidato ICE:', error);
        }
    }

    handleCallRejected(data) {
        console.log(`❌ Llamada rechazada por ${data.from}`);
        alert(`${data.from} rechazó la llamada`);
        this.cleanupCall();
    }

    handleCallEnded(data) {
        console.log(`📴 Llamada terminada por ${data.from}`);
        
        const reason = data.reason === 'user_disconnected' 
            ? 'El usuario se desconectó' 
            : 'Llamada finalizada';
        
        this.displayMessage({
            from: data.from,
            to: this.username,
            message: `📞 ${reason}`,
            type: 'call',
            timestamp: new Date().toISOString()
        });

        this.cleanupCall();
    }

    handleCallFailed(data) {
        console.log(`❌ Llamada fallida: ${data.reason}`);
        alert(`No se pudo conectar la llamada: ${data.to} no está disponible`);
        this.cleanupCall();
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = connected ? 'status-connected' : 'status-disconnected';
            statusEl.textContent = connected ? '● Conectado' : '○ Desconectado';
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

                messageInput.value = '';
                // El mensaje llegará via WebSocket
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

        console.log('Iniciando grabación de voz...');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Micrófono accedido correctamente');
            
            // Detectar el mejor mimeType soportado
            let mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/ogg';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = ''; // Usar el default del navegador
                    }
                }
            }
            console.log('Usando mimeType:', mimeType || 'default');
            
            const options = mimeType ? { mimeType } : {};
            this.mediaRecorder = new MediaRecorder(stream, options);
            this.audioChunks = [];
            this.currentAudioStream = stream; // Guardar referencia al stream

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                console.log('Grabación detenida, procesando audio...');
                const audioBlob = new Blob(this.audioChunks, { type: mimeType || 'audio/webm' });
                console.log('Audio blob creado, tamaño:', audioBlob.size);
                
                // Convertir a Base64
                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Audio = reader.result.split(',')[1];
                    console.log('Audio convertido a Base64, longitud:', base64Audio?.length);
                    
                    try {
                        const response = await fetch(`${this.API_URL}/sendVoiceNote`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                from: this.username,
                                to: this.targetUser,
                                audioData: base64Audio,
                                isGroup: this.isGroupChat
                            })
                        });
                        console.log('Nota de voz enviada, respuesta:', response.status);
                    } catch (error) {
                        console.error('Error enviando nota de voz:', error);
                        alert('Error al enviar nota de voz');
                    }
                };
                reader.readAsDataURL(audioBlob);

                // Detener el stream
                if (this.currentAudioStream) {
                    this.currentAudioStream.getTracks().forEach(track => track.stop());
                    this.currentAudioStream = null;
                }
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateRecordingUI(true);

            // Detener después de 60 segundos máximo
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, 60000);

        } catch (error) {
            console.error('Error accediendo al micrófono:', error);
            alert('Error al acceder al micrófono. Asegúrate de dar permisos.');
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
                btn.innerHTML = '⏹ Detener';
            } else {
                btn.classList.remove('recording');
                btn.innerHTML = '🎤 Voz';
            }
        }
    }

    async startCall() {
        console.log('=== startCall (WebRTC) ===');
        console.log('targetUser:', this.targetUser);
        console.log('isInCall:', this.isInCall);
        
        if (!this.targetUser) {
            alert('⚠️ Primero selecciona un usuario o grupo para llamar');
            return;
        }

        if (this.isInCall) {
            console.log('Terminando llamada...');
            this.endCall();
            return;
        }

        try {
            this.callPeer = this.targetUser;

            // Obtener audio local
            console.log('Solicitando acceso al micrófono...');
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false
            });
            console.log('✓ Micrófono activado');

            // Crear PeerConnection
            this.createPeerConnection();

            // Añadir tracks locales al peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Crear oferta SDP
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log('✓ Oferta SDP creada');

            // Enviar oferta via WebSocket
            this.ws.send(JSON.stringify({
                type: 'call-offer',
                to: this.targetUser,
                offer: offer,
                isGroup: this.isGroupChat
            }));

            console.log('📞 Llamando a', this.targetUser);

            // Iniciar UI de llamada (esperando respuesta)
            this.isInCall = true;
            this.updateCallUI(true);
            this.startCallTimer();
            this.showCallIndicator();

            this.displayMessage({
                from: this.username,
                to: this.targetUser,
                message: '📞 Llamando...',
                type: 'call',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error iniciando llamada:', error);
            
            if (error.name === 'NotAllowedError') {
                alert('❌ Permiso de micrófono denegado.');
            } else if (error.name === 'NotFoundError') {
                alert('❌ No se encontró micrófono.');
            } else {
                alert('❌ Error al iniciar llamada: ' + error.message);
            }
            this.cleanupCall();
        }
    }

    // Crear y configurar RTCPeerConnection
    createPeerConnection() {
        console.log('Creando RTCPeerConnection...');
        
        this.peerConnection = new RTCPeerConnection(this.iceServers);

        // Manejar candidatos ICE locales
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Candidato ICE local generado');
                this.ws.send(JSON.stringify({
                    type: 'ice-candidate',
                    to: this.callPeer,
                    candidate: event.candidate
                }));
            }
        };

        // Manejar cambios de estado de conexión
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Estado de conexión:', this.peerConnection.connectionState);
            
            if (this.peerConnection.connectionState === 'connected') {
                console.log('🎉 Conexión WebRTC establecida!');
            } else if (this.peerConnection.connectionState === 'failed' || 
                       this.peerConnection.connectionState === 'disconnected') {
                console.log('Conexión perdida');
                this.cleanupCall();
            }
        };

        // Manejar stream remoto (audio del otro usuario)
        this.peerConnection.ontrack = (event) => {
            console.log('🔊 Stream remoto recibido!');
            this.remoteStream = event.streams[0];
            
            // Reproducir audio remoto
            let remoteAudio = document.getElementById('remoteAudio');
            if (!remoteAudio) {
                remoteAudio = document.createElement('audio');
                remoteAudio.id = 'remoteAudio';
                remoteAudio.autoplay = true;
                document.body.appendChild(remoteAudio);
            }
            remoteAudio.srcObject = this.remoteStream;
            console.log('✓ Audio remoto conectado');
        };

        console.log('✓ RTCPeerConnection creado');
    }

    showCallIndicator() {
        const callIndicator = document.getElementById('callIndicator');
        if (callIndicator) {
            callIndicator.style.display = 'flex';
        }
    }

    hideCallIndicator() {
        const callIndicator = document.getElementById('callIndicator');
        if (callIndicator) {
            callIndicator.style.display = 'none';
        }
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            const timerEl = document.getElementById('callTimer');
            if (timerEl) {
                timerEl.textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }

    endCall() {
        console.log('=== Terminando llamada WebRTC ===');
        
        // Notificar al otro usuario
        if (this.callPeer && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'call-end',
                to: this.callPeer,
                callId: this.currentCallId
            }));
        }

        // Calcular duración antes de limpiar
        const duration = this.callStartTime 
            ? Math.floor((Date.now() - this.callStartTime) / 1000) 
            : 0;
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Mostrar mensaje de fin de llamada
        if (this.callPeer) {
            this.displayMessage({
                from: this.username,
                to: this.callPeer,
                message: `📞 Llamada finalizada (${durationStr})`,
                type: 'call',
                timestamp: new Date().toISOString()
            });
        }

        console.log('✓ Llamada terminada, duración:', durationStr);

        this.cleanupCall();
    }

    // Limpiar todos los recursos de la llamada
    cleanupCall() {
        console.log('Limpiando recursos de llamada...');

        // Cerrar PeerConnection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Detener stream local
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log('Track local detenido:', track.kind);
            });
            this.localStream = null;
        }

        // Detener stream remoto
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        // Limpiar audio remoto
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio) {
            remoteAudio.srcObject = null;
        }

        // Ocultar indicador de llamada
        this.hideCallIndicator();

        // Detener timer
        if (this.callTimerInterval) {
            clearInterval(this.callTimerInterval);
            this.callTimerInterval = null;
        }

        // Resetear estado
        this.isInCall = false;
        this.callStartTime = null;
        this.currentCallId = null;
        this.callPeer = null;
        this.pendingCandidates = [];
        this.updateCallUI(false);

        console.log('✓ Recursos de llamada limpiados');
    }

    updateCallUI(inCall) {
        const btn = document.getElementById('callBtn');
        if (btn) {
            if (inCall) {
                btn.classList.add('in-call');
                btn.innerHTML = '📞 Colgar';
            } else {
                btn.classList.remove('in-call');
                btn.innerHTML = '📞 Llamar';
            }
        }
    }

    async createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();
        
        console.log('createGroup interno llamado, nombre:', groupName);

        if (groupName) {
            try {
                const response = await fetch(`${this.API_URL}/createGroup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ groupName })
                });
                const result = await response.json();
                console.log('Grupo creado, respuesta:', result);
                alert(`Grupo creado: ${groupName}`);
                groupInput.value = '';
                this.loadGroups();
            } catch (error) {
                console.error('Error creando grupo:', error);
                alert('Error al crear grupo: ' + error.message);
            }
        } else {
            alert('Por favor ingresa un nombre para el grupo');
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
            this.updateGroupList(groups);
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
                if (user === this.targetUser && !this.isGroupChat) {
                    el.classList.add('active');
                }
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
            if (group === this.targetUser && this.isGroupChat) {
                el.classList.add('active');
            }
            el.innerHTML = `<div class="group-avatar">#</div><span>${group}</span>`;
            el.onclick = () => this.selectGroup(group);
            groupsList.appendChild(el);
        });
    }

    displayMessage(msg) {
        const container = document.getElementById('messagesContainer');
        if (!container) return;
        
        // Evitar duplicados
        const existingMsgs = container.querySelectorAll('.message');
        for (let i = existingMsgs.length - 1; i >= Math.max(0, existingMsgs.length - 5); i--) {
            const existing = existingMsgs[i];
            if (existing.dataset.from === msg.from && 
                existing.dataset.message === (msg.message || msg.content)) {
                return; // Ya existe
            }
        }
        
        const messageEl = this.createMessageElement(msg);
        container.appendChild(messageEl);
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
        div.dataset.from = m.from;
        div.dataset.message = m.message || m.content;
        
        let content = '';
        if (m.type === 'audio' && m.audioData) {
            // Determinar si audioData ya incluye el prefijo o es solo Base64
            let audioSrc = m.audioData;
            if (!audioSrc.startsWith('data:')) {
                audioSrc = `data:audio/webm;base64,${audioSrc}`;
            }
            content = `
                <div class="audio-message">
                    <span class="audio-icon">🎵</span>
                    <audio controls>
                        <source src="${audioSrc}" type="audio/webm">
                        Tu navegador no soporta audio.
                    </audio>
                </div>
            `;
        } else if (m.type === 'call') {
            content = `<div class="call-message">📞 ${this.escapeHtml(m.message || m.content)}</div>`;
        } else {
            content = `<div class="text">${this.escapeHtml(m.message || m.content)}</div>`;
        }
        
        const timestamp = m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        div.innerHTML = `
            <div class="avatar" style="background-color:${this.getAvatarColor(m.from)}">
                ${m.from[0].toUpperCase()}
            </div>
            <div class="text-wrapper">
                ${!own ? `<div class="user-name">${this.escapeHtml(m.from)}</div>` : ''}
                ${content}
                <div class="timestamp">${timestamp}</div>
            </div>`;
        return div;
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
        
        // Actualizar listas para marcar el seleccionado
        this.loadUsers();
        this.loadGroups();
    }

    getAvatarColor(u) {
        return this.colors[u.charCodeAt(0) % this.colors.length];
    }

    escapeHtml(t) {
        if (!t) return '';
        const div = document.createElement('div');
        div.textContent = t;
        return div.innerHTML;
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
    if (chatApp) chatApp.startCall(); 
    else console.error('chatApp no inicializado');
};
