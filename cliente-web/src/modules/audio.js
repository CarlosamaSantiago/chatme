/**
 * Módulo para grabación y envío de notas de voz
 */

export class AudioHandler {
    constructor(chatApp) {
        this.app = chatApp;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentAudioStream = null;
    }

    async sendVoiceNote() {
        if (!this.app.targetUser) {
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
                    
                    // Mostrar nota de voz inmediatamente (optimistic update)
                    const audioSrc = `data:${mimeType || 'audio/webm'};base64,${base64Audio}`;
                    const optimisticMessage = {
                        from: this.app.username,
                        to: this.app.targetUser,
                        message: '[Nota de voz]',
                        timestamp: Date.now(),
                        isGroup: this.app.isGroupChat,
                        type: 'audio',
                        audioData: audioSrc
                    };
                    this.app.ui.displayMessage(optimisticMessage);
                    
                    try {
                        const response = await fetch(`${this.app.API_URL}/sendVoiceNote`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                from: this.app.username,
                                to: this.app.targetUser,
                                audioData: base64Audio,
                                isGroup: this.app.isGroupChat
                            })
                        });
                        console.log('Nota de voz enviada, respuesta:', response.status);
                        // El callback Ice actualizará el mensaje con el timestamp real del servidor
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
}

