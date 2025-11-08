class ChatApp {
    constructor() {
        this.ws = null;
        this.username = '';
        this.targetUser = '';
        this.isGroupChat = false;
        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
        
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
        
        this.connect();
    }

    connect() {
        this.ws = new WebSocket('ws://localhost:3000');
        
        this.ws.onopen = () => {
            console.log('Conectado al servidor');
            this.register();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('Conexión cerrada');
            setTimeout(() => this.connect(), 3000);
        };
    }

    handleMessage(message) {
        switch(message.action) {
            case 'MESSAGE':
                this.displayMessage(message.message);
                break;
            case 'USER_LIST':
                this.updateUserList(message.users);
                break;
            case 'GROUP_LIST':
                this.updateGroupList(message.groups);
                break;
            case 'HISTORY':
                this.displayHistory(message.messages);
                break;
            case 'REGISTERED':
                console.log('Usuario registrado:', message.username);
                this.requestUserList();
                this.requestGroupList();
                break;
            case 'GROUP_CREATED':
                alert('Grupo creado: ' + message.groupName);
                break;
            case 'ERROR':
                alert('Error: ' + message.error);
                break;
        }
    }

    register() {
        this.send({
            action: 'REGISTER',
            username: this.username
        });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (message && this.targetUser) {
            this.send({
                action: 'SEND_MESSAGE',
                from: this.username,
                to: this.targetUser,
                message: message,
                isGroup: this.isGroupChat
            });
            
            messageInput.value = '';
        }
    }

    createGroup() {
        const groupInput = document.getElementById('newGroupName');
        const groupName = groupInput.value.trim();
        
        if (groupName) {
            this.send({
                action: 'CREATE_GROUP',
                groupName: groupName
            });
            groupInput.value = '';
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

    loadHistory(target) {
        this.send({
            action: 'GET_HISTORY',
            target: target,
            from: this.username,
            isGroup: this.isGroupChat
        });
    }

    requestUserList() {
        this.send({ action: 'GET_USERS' });
    }

    requestGroupList() {
        this.send({ action: 'GET_GROUPS' });
    }

    updateUserList(users) {
        const usersList = document.getElementById('usersList');
        usersList.innerHTML = '';
        
        users.forEach(user => {
            if (user !== this.username) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.innerHTML = `
                    <div class="avatar" style="background-color: ${this.getAvatarColor(user)}">
                        ${user[0].toUpperCase()}
                    </div>
                    <span>${user}</span>
                `;
                userElement.onclick = () => this.selectUser(user);
                usersList.appendChild(userElement);
            }
        });
    }

    updateGroupList(groups) {
        const groupsList = document.getElementById('groupsList');
        groupsList.innerHTML = '';
        
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = 'group-item';
            groupElement.innerHTML = `
                <div class="group-avatar">#</div>
                <span>${group}</span>
            `;
            groupElement.onclick = () => this.selectGroup(group);
            groupsList.appendChild(groupElement);
        });
    }

    displayMessage(messageData) {
        const messagesContainer = document.getElementById('messagesContainer');
        const messageElement = this.createMessageElement(messageData);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    displayHistory(messages) {
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        if (messages && Array.isArray(messages)) {
            messages.forEach(messageJson => {
                try {
                    const messageData = JSON.parse(messageJson);
                    const messageElement = this.createMessageElement(messageData);
                    messagesContainer.appendChild(messageElement);
                } catch (error) {
                    console.error('Error parsing history message:', error);
                }
            });
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    createMessageElement(messageData) {
        const isOwnMessage = messageData.from === this.username;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwnMessage ? 'right' : 'left'}`;
        
        messageDiv.innerHTML = `
            <div class="avatar" style="background-color: ${this.getAvatarColor(messageData.from)}">
                ${messageData.from[0].toUpperCase()}
            </div>
            <div class="text-wrapper">
                ${!isOwnMessage ? `<div class="user-name">${messageData.from}</div>` : ''}
                <div class="text">${this.escapeHtml(messageData.message)}</div>
                <div class="timestamp">${new Date().toLocaleTimeString()}</div>
            </div>
        `;
        
        return messageDiv;
    }

    updateChatInterface() {
        document.getElementById('chatTarget').textContent = this.targetUser;
        document.getElementById('groupBadge').style.display = this.isGroupChat ? 'inline-block' : 'none';
        document.getElementById('messageInputWrapper').style.display = 'block';
        document.getElementById('messageInput').placeholder = `Escribe un mensaje para ${this.targetUser}...`;
        
        // Actualizar clases activas
        document.querySelectorAll('.user-item, .group-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    getAvatarColor(user) {
        const index = user.charCodeAt(0) % this.colors.length;
        return this.colors[index];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('WebSocket no está conectado');
        }
    }

    setupEventListeners() {
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }
}

// Funciones globales para los botones HTML
let chatApp;

function sendMessage() {
    chatApp.sendMessage();
}

function createGroup() {
    chatApp.createGroup();
}

// Inicializar la aplicación cuando se carga la página
window.onload = function() {
    chatApp = new ChatApp();
};