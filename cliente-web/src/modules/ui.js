/**
 * Módulo para manipulación del DOM y UI
 */

export class UIHandler {
    constructor(chatApp) {
        this.app = chatApp;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
    }

    displayMessage(msg) {
        const container = document.getElementById('messagesContainer');
        if (!container) {
            console.warn('⚠️  No se encontró el contenedor de mensajes');
            return;
        }
        
        // Evitar duplicados - verificar los últimos 20 mensajes
        const existingMsgs = container.querySelectorAll('.message');
        const msgContent = String(msg.message || msg.content || '').trim();
        const msgTimestamp = msg.timestamp ? (typeof msg.timestamp === 'string' ? parseInt(msg.timestamp) : msg.timestamp) : Date.now();
        const msgFrom = String(msg.from || '').trim();
        
        // Solo verificar duplicados si el mensaje viene del mismo usuario
        // Esto evita que se filtren mensajes válidos de diferentes usuarios
        if (msgFrom) {
            for (let i = existingMsgs.length - 1; i >= Math.max(0, existingMsgs.length - 20); i--) {
                const existing = existingMsgs[i];
                const existingFrom = String(existing.dataset.from || '').trim();
                const existingMsg = String(existing.dataset.message || '').trim();
                const existingTime = existing.dataset.timestamp ? parseInt(existing.dataset.timestamp) : 0;
                
                // Verificar si es el mismo mensaje (mismo remitente, contenido idéntico y timestamp muy similar)
                // Usar una ventana de tiempo más estricta (2 segundos) para evitar falsos positivos
                // IMPORTANTE: Solo considerar duplicado si viene del MISMO usuario Y el contenido es idéntico
                if (existingFrom === msgFrom && 
                    existingMsg === msgContent &&
                    msgContent.length > 0 && // Solo verificar si hay contenido
                    Math.abs(existingTime - msgTimestamp) < 2000) {
                    console.log('⚠️  Mensaje duplicado detectado, ignorando');
                    console.log(`   Existente: from=${existingFrom}, msg="${existingMsg.substring(0, 30)}...", time=${existingTime}`);
                    console.log(`   Nuevo: from=${msgFrom}, msg="${msgContent.substring(0, 30)}...", time=${msgTimestamp}`);
                    return; // Ya existe
                }
            }
        }
        
        console.log('✅ Agregando nuevo mensaje al chat:', msgFrom, '->', msg.to);
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
        const own = m.from === this.app.username;
        const div = document.createElement('div');
        div.className = `message ${own ? 'right' : 'left'}`;
        div.dataset.from = m.from;
        div.dataset.message = m.message || m.content || '';
        // Guardar timestamp para detección de duplicados
        const msgTimestamp = m.timestamp ? (typeof m.timestamp === 'string' ? parseInt(m.timestamp) : m.timestamp) : Date.now();
        div.dataset.timestamp = msgTimestamp.toString();
        
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
        
        // Convertir timestamp a fecha legible
        let timestamp;
        if (m.timestamp) {
            if (typeof m.timestamp === 'string') {
                timestamp = new Date(parseInt(m.timestamp)).toLocaleTimeString();
            } else {
                timestamp = new Date(m.timestamp).toLocaleTimeString();
            }
        } else {
            timestamp = new Date().toLocaleTimeString();
        }
        
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
        document.getElementById('chatTarget').textContent = this.app.targetUser;
        document.getElementById('groupBadge').style.display = this.app.isGroupChat ? 'inline-block' : 'none';

        const inputWrapper = document.getElementById('messageInputWrapper');
        if (this.app.targetUser) {
            inputWrapper.style.display = 'flex';
        } else {
            inputWrapper.style.display = 'none';
        }
        
        // Actualizar listas para marcar el seleccionado
        this.app.loadUsers();
        this.app.loadGroups();
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        if (!users || users.length === 0) {
            usersList.innerHTML = '<p style="color:#95a5a6;font-size:12px;padding:10px;">No hay usuarios</p>';
            return;
        }
        users.forEach(user => {
            const el = document.createElement('div');
            el.className = 'user-item';
            if (user === this.app.targetUser && !this.app.isGroupChat) {
                el.classList.add('active');
            }
            el.innerHTML = `<div class="avatar" style="background-color:${this.getAvatarColor(user)}">${user[0].toUpperCase()}</div><span>${user}</span>`;
            el.onclick = () => this.app.selectUser(user);
            usersList.appendChild(el);
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
            const el = this.createGroupElement(group);
            groupsList.appendChild(el);
        });
    }

    addGroupToList(groupName) {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) return;
        
        // Verificar si ya existe
        const existing = Array.from(groupsList.children).find(
            el => {
                const span = el.querySelector('span');
                return span && span.textContent.trim() === groupName;
            }
        );
        if (existing) return;
        
        // Remover mensaje "No hay grupos" si existe
        const noGroupsMsg = groupsList.querySelector('p');
        if (noGroupsMsg) {
            noGroupsMsg.remove();
        }
        
        const el = this.createGroupElement(groupName);
        groupsList.appendChild(el);
    }

    removeGroupFromList(groupName) {
        const groupsList = document.getElementById('groupsList');
        if (!groupsList) return;
        
        const groupEl = Array.from(groupsList.children).find(
            el => {
                const span = el.querySelector('span');
                return span && span.textContent.trim() === groupName;
            }
        );
        
        if (groupEl) {
            groupEl.remove();
        }
        
        // Si no quedan grupos, mostrar mensaje
        if (groupsList.children.length === 0) {
            groupsList.innerHTML = '<p style="color:#95a5a6;font-size:12px;padding:10px;">No hay grupos</p>';
        }
    }

    createGroupElement(group) {
        const el = document.createElement('div');
        el.className = 'group-item';
        if (group === this.app.targetUser && this.app.isGroupChat) {
            el.classList.add('active');
        }
        el.innerHTML = `<div class="group-avatar">#</div><span>${group}</span>`;
        el.onclick = () => this.app.selectGroup(group);
        return el;
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = connected ? 'status-connected' : 'status-disconnected';
            statusEl.textContent = connected ? '● Conectado' : '○ Desconectado';
        }
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
}

