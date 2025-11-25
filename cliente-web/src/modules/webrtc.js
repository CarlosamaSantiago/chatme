/**
 * Módulo para manejo de llamadas WebRTC
 */

export class WebRTCHandler {
    constructor(chatApp) {
        this.app = chatApp;
        this.isInCall = false;
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.currentCallId = null;
        this.pendingCandidates = [];
        this.callPeer = null;
        this.callTimerInterval = null;
        this.callStartTime = null;
        
        // Configuración de servidores ICE (STUN públicos para NAT traversal)
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }

    async startCall() {
        console.log('=== startCall (WebRTC) ===');
        console.log('targetUser:', this.app.targetUser);
        console.log('isInCall:', this.isInCall);
        
        if (!this.app.targetUser) {
            alert('⚠️ Primero selecciona un usuario o grupo para llamar');
            return;
        }

        if (this.isInCall) {
            console.log('Terminando llamada...');
            this.endCall();
            return;
        }

        try {
            this.callPeer = this.app.targetUser;

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
            this.app.ws.send(JSON.stringify({
                type: 'call-offer',
                to: this.app.targetUser,
                offer: offer,
                isGroup: this.app.isGroupChat
            }));

            console.log('📞 Llamando a', this.app.targetUser);

            // Iniciar UI de llamada (esperando respuesta)
            this.isInCall = true;
            this.updateCallUI(true);
            this.startCallTimer();
            this.showCallIndicator();

            this.app.ui.displayMessage({
                from: this.app.username,
                to: this.app.targetUser,
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

    async handleCallOffer(data) {
        const { from, offer, callId, isGroup } = data;
        console.log(`📞 Oferta de llamada recibida de ${from}`);

        // Si ya estamos en una llamada, rechazar
        if (this.isInCall) {
            this.app.ws.send(JSON.stringify({
                type: 'call-reject',
                to: from,
                callId: callId
            }));
            return;
        }

        // Mostrar diálogo de aceptar/rechazar
        const accept = confirm(`📞 Llamada entrante de ${from}. ¿Aceptar?`);
        
        if (!accept) {
            this.app.ws.send(JSON.stringify({
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
            this.app.targetUser = from;
            this.app.isGroupChat = isGroup || false;
            this.app.ui.updateChatInterface();

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
            this.app.ws.send(JSON.stringify({
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

            this.app.ui.displayMessage({
                from: from,
                to: this.app.username,
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

    async handleCallAnswer(data) {
        const { from, answer } = data;
        console.log(`✅ Respuesta de llamada recibida de ${from}`);

        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✓ Respuesta remota establecida - Llamada conectada!');

            this.app.ui.displayMessage({
                from: this.app.username,
                to: from,
                message: '📞 Llamada conectada',
                type: 'call',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error procesando respuesta:', error);
        }
    }

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
        
        this.app.ui.displayMessage({
            from: data.from,
            to: this.app.username,
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

    createPeerConnection() {
        console.log('Creando RTCPeerConnection...');
        
        this.peerConnection = new RTCPeerConnection(this.iceServers);

        // Manejar candidatos ICE locales
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Candidato ICE local generado');
                this.app.ws.send(JSON.stringify({
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
        if (this.callPeer && this.app.ws && this.app.ws.readyState === WebSocket.OPEN) {
            this.app.ws.send(JSON.stringify({
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
            this.app.ui.displayMessage({
                from: this.app.username,
                to: this.callPeer,
                message: `📞 Llamada finalizada (${durationStr})`,
                type: 'call',
                timestamp: new Date().toISOString()
            });
        }

        console.log('✓ Llamada terminada, duración:', durationStr);

        this.cleanupCall();
    }

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
        this.callPeer = null;
        this.currentCallId = null;
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
}

