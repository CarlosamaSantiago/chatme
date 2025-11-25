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
        this.eventSource = null;

        this.init();
    }

    init() {
        this.getUsername();
        this.setupEventListeners();
        this.setupRealTimeUpdates();
    }

    getUsername() {
        this.username = prompt('Ingresa tu nombre:') || 'Usuario' + Math.floor(Math.random() * 1000);
        document.getElementById('usernameDisplay').textContent = this.username;
        document.getElementById('userAvatar').textContent = this.username[0].toUpperCase();
        document.getElementById('userAvatar').style.backgroundColor = this.getAvatarColor(this.username);
        
        this.registerUser();
        this.refreshLists();
    }

    setupRealTimeUpdates() {
        this.eventSource = new EventSource(this.API_URL + '/updates');
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("📨 Evento recibido:", data);
                this.handleRealTimeUpdate(data);
            } catch (error) {
                console.error('Error procesando evento:', error);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('Error en conexión SSE:', error);
        };
    }

    handleRealTimeUpdate(data) {
        switch(data.action) {
            case 'MESSAGE':
                this.displayMessage(data.message);
                break;
            case 'USER_LIST':
                this.updateUserList(data.users);
                break;
            case 'GROUP_LIST':
                this.updateGroupList(data.groups);
                break;
            default:
                console.log('Evento no manejado:', data);
        }
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

                // El mensaje se mostrará via SSE cuando llegue del servidor
                messageInput.value = '';
            } catch (error) {
                console.error('Error enviando mensaje:', error);
                alert('Error al enviar mensaje: ' + error.message);
            }
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
                // La lista de grupos se actualizará via SSE
            } catch (error) {
                console.error('Error creando grupo:', error);
                alert('Error creando grupo: ' + error.message);
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
                <div class="timestamp">${new Date().toLocaleTimeString()}</div>
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
    }
sssss
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
