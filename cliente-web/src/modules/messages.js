/**
 * Módulo para manejo de mensajes
 * Incluye envío, recepción y validación de mensajes
 */

export class MessageHandler {
    constructor(chatApp) {
        this.app = chatApp;
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message && this.app.targetUser) {
            // Mostrar mensaje inmediatamente (optimistic update)
            const optimisticMessage = {
                from: this.app.username,
                to: this.app.targetUser,
                message: message,
                timestamp: Date.now(),
                isGroup: this.app.isGroupChat,
                type: 'text'
            };
            this.app.ui.displayMessage(optimisticMessage);
            messageInput.value = '';
            
            try {
                console.log(`📤 [Cliente] Enviando mensaje: ${this.app.username} -> ${this.app.targetUser}`);
                const response = await fetch(`${this.app.API_URL}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        from: this.app.username,
                        to: this.app.targetUser,
                        message: message,
                        isGroup: this.app.isGroupChat
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('✅ Mensaje enviado, respuesta:', result);
                
                // El callback Ice actualizará el mensaje con el timestamp real del servidor
                // displayMessage() ya previene duplicados, así que no habrá problema
            } catch (error) {
                console.error('❌ Error enviando mensaje:', error);
                alert('Error al enviar mensaje: ' + error.message);
            }
        }
    }

    handleNewMessage(message) {
        console.log('📨 [Cliente] Nuevo mensaje recibido:', message);
        console.log('   Usuario actual:', this.app.username);
        console.log('   TargetUser:', this.app.targetUser);
        console.log('   Mensaje from:', message.from, 'to:', message.to, 'isGroup:', message.isGroup);
        
        // Validar que el mensaje tenga los campos necesarios
        if (!message || !message.from || !message.to) {
            console.error('⚠️  Mensaje inválido recibido:', message);
            return;
        }
        
        // Normalizar valores para comparación
        const msgFrom = String(message.from || '').trim();
        const msgTo = String(message.to || '').trim();
        const targetUser = String(this.app.targetUser || '').trim();
        const username = String(this.app.username || '').trim();
        const isGroup = message.isGroup || false;
        
        // Verificar si el mensaje es relevante para el chat actual
        let isRelevant = false;
        
        if (!targetUser || targetUser === '') {
            // Sin chat abierto: mostrar si es para el usuario actual
            isRelevant = (msgTo === username || msgFrom === username);
        } else if (isGroup) {
            // Chat de grupo: mostrar si es del grupo abierto
            isRelevant = (msgTo === targetUser);
        } else {
            // Chat directo: mostrar si involucra al usuario actual Y al targetUser
            // Caso 1: Mensaje viene del targetUser y va al usuario actual (recibiendo mensaje)
            // Caso 2: Mensaje viene del usuario actual y va al targetUser (enviando mensaje)
            const isFromTargetToMe = (msgFrom === targetUser && msgTo === username);
            const isFromMeToTarget = (msgFrom === username && msgTo === targetUser);
            
            // Verificación adicional: si el mensaje involucra a ambos usuarios
            const involvesMe = (msgFrom === username || msgTo === username);
            const involvesTarget = (msgFrom === targetUser || msgTo === targetUser);
            
            isRelevant = isFromTargetToMe || isFromMeToTarget || (involvesMe && involvesTarget);
        }
        
        console.log('   ¿Es relevante para el chat actual?', isRelevant);
        console.log('   Comparación:', {
            msgFrom, msgTo, targetUser, username, isGroup,
            isFromTargetToMe: targetUser && !isGroup ? (msgFrom === targetUser && msgTo === username) : 'N/A',
            isFromMeToTarget: targetUser && !isGroup ? (msgFrom === username && msgTo === targetUser) : 'N/A',
            involvesMe: targetUser ? (msgFrom === username || msgTo === username) : 'N/A',
            involvesTarget: targetUser ? (msgFrom === targetUser || msgTo === targetUser) : 'N/A'
        });
        
        if (isRelevant) {
            console.log('   ✅ Mostrando mensaje en el chat');
            this.app.ui.displayMessage(message);
        } else {
            console.log('   ⚠️  Mensaje no es relevante para el chat actual');
            console.log('   Valores exactos:', {
                msgFrom: `"${msgFrom}"`,
                msgTo: `"${msgTo}"`,
                targetUser: `"${targetUser}"`,
                username: `"${username}"`,
                msgFromLength: msgFrom.length,
                targetUserLength: targetUser.length,
                usernameLength: username.length
            });
            
            // Si el mensaje es para el usuario actual pero no tiene el chat abierto,
            // aún así mostrar notificación
            if (msgTo === username && msgFrom !== username) {
                console.log('   📬 Mensaje recibido pero chat no abierto - mostrando notificación');
            }
        }
        
        // Mostrar notificación si el mensaje no es del usuario actual
        if (msgFrom !== username) {
            this.showNotification(message);
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

    async loadHistory(target) {
        try {
            const response = await fetch(`${this.app.API_URL}/getHistory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    from: this.app.username,
                    isGroup: this.app.isGroupChat
                })
            });
            const result = await response.json();
            
            // Parsear mensajes si vienen como strings JSON
            let messages = [];
            if (result.messages && Array.isArray(result.messages)) {
                messages = result.messages.map(m => {
                    if (typeof m === 'string') {
                        try {
                            return JSON.parse(m);
                        } catch (e) {
                            return null;
                        }
                    }
                    return m;
                }).filter(m => m !== null);
            }
            
            this.app.ui.displayHistory(messages);
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    }
}

