import iceDelegate from './services/iceDelegate.js';

class ChatApp {
    constructor() {
        this.username = '';
        this.targetUser = '';
        this.isGroupChat = false;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        this.pollingInterval = null;
        this.lastMessageCount = 0;

        this.init();
    }

    async init() {
        // Inicializar ICE
        await iceDelegate.init();
        
        // Configurar listeners para eventos del observer
        window.addEventListener('newUser', (e) => {
            this.refreshLists();
        });
        
        window.addEventListener('newGroup', (e) => {
            this.refreshLists();
        });
        
        window.addEventListener('newMessage', (e) => {
            const message = e.detail;
            // Si el mensaje es para el chat actual, actualizar
            if ((this.isGroupChat && message.to === this.targetUser) ||
                (!this.isGroupChat && 
                 ((message.from === this.targetUser && message.to === this.username) ||
                  (message.to === this.targetUser && message.from === this.username)))) {
                this.loadHistory(this.targetUser);
            }
        });
        
        this.getUsername();
        this.setupEventListeners();
        setInterval(() => this.refreshLists(), 5000); // cada 5 segs
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
            await iceDelegate.registerUser(this.username);
            console.log('Usuario registrado:', this.username);
        } catch (err) {
            console.error('Error registrando usuario', err);
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();

        if (message && this.targetUser) {
            try {
                await iceDelegate.sendMessage(this.username, this.targetUser, message, this.isGroupChat);

                this.displayMessage({
                    from: this.username,
                    to: this.targetUser,
                    message: message
                });

                messageInput.value = '';
                setTimeout(() => this.loadHistory(this.targetUser), 500);
            } catch (error) {
                console.error('Error enviando mensaje:', error);
                alert('Error al enviar mensaje');
            }
        }
    }

    async createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();

        if (groupName) {
            try {
                await iceDelegate.createGroup(groupName);
                alert(`Grupo creado: ${groupName}`);
                groupInput.value = '';
                this.loadGroups();
            } catch (error) {
                console.error('Error creando grupo:', error);
                alert('Error al crear grupo: ' + error.message);
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
            const messages = await iceDelegate.getHistory(target, this.username, this.isGroupChat);
            if (messages && messages.length > 0) {
                // Convertir MessageDTO a formato esperado
                const formattedMessages = messages.map(msg => ({
                    from: msg.from,
                    to: msg.to,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    isGroup: msg.isGroup
                }));
                this.displayHistory(formattedMessages);
            } else {
                this.displayHistory([]);
            }
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
            const groups = await iceDelegate.getGroups();
            if (groups) {
                this.updateGroupList(Array.from(groups));
            }
        } catch (error) {
            console.error('Error cargando grupos:', error);
        }
    }

    async loadUsers() {
        try {
            const users = await iceDelegate.getUsers();
            if (users) {
                this.updateUserList(Array.from(users));
            }
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
        const div = document.createElement('div');
        div.className = `message ${own ? 'right' : 'left'}`;
        div.innerHTML = `
            <div class="avatar" style="background-color:${this.getAvatarColor(m.from)}">
                ${m.from[0].toUpperCase()}
            </div>
            <div class="text-wrapper">
                ${!own ? `<div class="user-name">${this.escapeHtml(m.from)}</div>` : ''}
                <div class="text">${this.escapeHtml(m.message)}</div>
                <div class="timestamp">${m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}</div>
            </div>`;
        return div;
    }

    updateChatInterface() {
        document.getElementById('chatTarget').textContent = this.targetUser;
        document.getElementById('groupBadge').style.display = this.isGroupChat ? 'inline-block' : 'none';

        // Mostrar el input solo si hay un target seleccionado
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
