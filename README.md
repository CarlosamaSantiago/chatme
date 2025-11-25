# 💬 ChatMe - Aplicación de Chat con ZeroC Ice RPC

## 👥 Integrantes
- Santiago Carlosama
- Joshua Sayur
- Paula Andrea Piedrahita
- Jean Carlo Ocampo

## Descripción General

**ChatMe** es una aplicación de mensajería en tiempo real que permite:
- Enviar mensajes de texto entre usuarios
- Crear y participar en grupos de chat
- Enviar notas de voz grabadas desde el navegador
- Realizar llamadas de voz entre usuarios (WebRTC)
- Visualizar historial de conversaciones

La aplicación implementa una arquitectura de **tres capas** utilizando **ZeroC Ice** como middleware RPC para la comunicación entre el proxy y el servidor backend. **Todas las comunicaciones en tiempo real utilizan WebSockets de Ice** mediante callbacks bidireccionales, cumpliendo con el requisito de usar "ws (WebSockets) de ICE para reflejar un comportamiento en tiempo real de todos los servicios".

### Componentes Principales

| Componente | Tecnología | Puerto | Función |
|------------|------------|--------|---------|
| Cliente Web | HTML/CSS/JS | 8080 | Interfaz de usuario |
| Proxy HTTP | Node.js/Express | 3000 | Middleware, WebSocket, API REST, Ice RPC Client |
| IceChatServer | Java/Ice | 10000 (Ice WS) | Backend, lógica de negocio, Ice RPC Server |

---

## 🔄 Flujo de Comunicación

### 1. Flujo de Registro de Usuario

```
┌──────────┐     POST /register      ┌──────────┐     TCP Socket      ┌──────────────┐
│ Cliente  │ ──────────────────────► │  Proxy   │ ─────────────────► │ IceChatServer │
│   Web    │     {username:"Ana"}    │   HTTP   │  {action:"REGISTER" │    (Java)     │
└──────────┘                         └──────────┘   username:"Ana"}   └──────────────┘
     │                                    │                                  │
     │◄───── JSON Response ───────────────│◄────── JSON Response ───────────│
     │      {action:"REGISTERED"}         │       {action:"REGISTERED"}      │
     │                                    │                                  │
     │         WebSocket                  │                                  │
     │◄────────────────────────────────────                                  │
     │  Conexión WS para tiempo real                                         │
```

### 2. Flujo de Envío de Mensaje

```
Usuario A envía mensaje a Usuario B:

1. Cliente A (MessageHandler.sendMessage()):
   - Muestra mensaje optimista inmediatamente (UI)
   - POST /sendMessage {from:"A", to:"B", message:"Hola"}
        │
        ▼
2. Proxy (index.js):
   - Recibe petición HTTP
   - iceBridge.callIceMethod('sendMessage', params)
        │
        ▼ Ice RPC (WebSocket) puerto 10000
        │
3. IceChatServer (ChatServiceI.sendMessage()): 
   - Guarda mensaje en historial
   - Persiste en history.json
   - Llama a callbacks Ice registrados (WebSocket bidireccional)
        │
        ▼ Ice Callback (WebSocket bidireccional)
        │
4. Proxy (MessageCallbackI.onMessage()):
   - Recibe notificación via Ice WebSocket
   - messageHandler procesa el mensaje
        │
        ▼
5. Proxy: Envía via WebSocket a usuarios conectados
        │
        ├──────► WebSocket a Usuario B: {type:"newMessage", message:{...}}
        │
        └──────► WebSocket a Usuario A: {type:"newMessage", message:{...}}
        │
        ▼
6. Cliente A (MessageHandler.handleNewMessage()):
   - Verifica si mensaje es relevante para chat actual
   - Si está en chat con B: muestra mensaje (actualiza con timestamp del servidor)
   - Si no está en chat con B: solo notificación
        │
        ▼
7. Cliente B (MessageHandler.handleNewMessage()):
   - Verifica si mensaje es relevante para chat actual
   - Si está en chat con A: muestra mensaje inmediatamente
   - Si no está en chat con A: muestra notificación
```

### 3. Flujo de Nota de Voz

```
1. Usuario presiona "🎤 Voz"
        │
        ▼
2. MediaRecorder graba audio del micrófono
        │
        ▼
3. Usuario presiona "⏹ Detener"
        │
        ▼
4. Audio convertido a Base64
        │
        ▼
5. POST /sendVoiceNote {from, to, audioData (Base64), isGroup}
        │
        ▼
6. Proxy → iceBridge → IceChatServer
        │
        ▼
7. Servidor guarda en historial con type:"audio"
        │
        ▼
8. WebSocket notifica a destinatarios
        │
        ▼
9. Clientes muestran reproductor de audio
```

### 4. Flujo de Llamada de Voz (WebRTC)

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│  Usuario A  │                    │    Proxy    │                    │  Usuario B  │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │  1. Click "Llamar"               │                                  │
       │  getUserMedia (micrófono)        │                                  │
       │  createOffer (SDP)               │                                  │
       │                                  │                                  │
       │──── WS: call-offer + SDP ───────►│                                  │
       │                                  │──── WS: call-offer + SDP ───────►│
       │                                  │                                  │
       │                                  │                    2. ¿Aceptar?  │
       │                                  │                    getUserMedia  │
       │                                  │                    createAnswer  │
       │                                  │                                  │
       │                                  │◄─── WS: call-answer + SDP ───────│
       │◄─── WS: call-answer + SDP ───────│                                  │
       │                                  │                                  │
       │  3. setRemoteDescription         │                                  │
       │                                  │                                  │
       │──── WS: ice-candidate ──────────►│──── WS: ice-candidate ──────────►│
       │◄─── WS: ice-candidate ───────────│◄─── WS: ice-candidate ───────────│
       │                                  │                                  │
       │                                  │                                  │
       │◄═══════════════ CONEXIÓN P2P DIRECTA ══════════════════════════════►│
       │              Audio fluye sin pasar por el servidor                  │
       │                                  │                                  │
```


## 📦 Descripción de Módulos

### 🌐 Módulo: Cliente Web (`cliente-web/`)

**Propósito:** Proporcionar la interfaz gráfica de usuario en el navegador.

**Responsabilidades:**
- Mostrar la interfaz de chat
- Capturar entrada del usuario (mensajes, audio)
- Comunicarse con el proxy via HTTP y WebSocket
- Manejar llamadas de voz con WebRTC
- Actualizar la UI en tiempo real

**Tecnologías:**
- HTML5, CSS3, JavaScript (ES6+ con módulos)
- Webpack 5 para empaquetado
- Babel para transpilación
- WebRTC para llamadas P2P
- MediaRecorder API para grabación de audio
- Arquitectura modular (separación de responsabilidades)

---

### 🔌 Módulo: Proxy HTTP (`proxy-http/`)

**Propósito:** Actuar como intermediario entre el cliente web y el servidor Java.

**Responsabilidades:**
- Exponer API REST para el cliente
- Manejar conexiones WebSocket para tiempo real
- Traducir peticiones HTTP a formato Ice/TCP
- Gestionar señalización WebRTC
- Broadcast de mensajes en tiempo real

**Tecnologías:**
- Node.js
- Express.js (servidor HTTP)
- ws (WebSocket)
- ice (ZeroC Ice para Node.js)

---

### ☕ Módulo: Servidor Java (`servidor-java/`)

**Propósito:** Backend que implementa toda la lógica de negocio.

**Responsabilidades:**
- Gestionar usuarios registrados
- Crear y administrar grupos
- Almacenar y recuperar historial de mensajes
- Implementar Ice RPC para clientes nativos
- Persistir datos en archivo JSON

**Tecnologías:**
- Java 11+
- ZeroC Ice
- Gradle (build system)
- Concurrencia con ExecutorService

---


## 🚀 Instrucciones de Ejecución

### Requisitos Previos
- Java JDK 11 o superior
- Node.js 16 o superior
- npm (incluido con Node.js)

### Paso 1: Iniciar el Servidor Java

```bash
cd servidor-java
./gradlew build
./gradlew run
```

**Output esperado:**
```
Servidor original iniciado en puerto 5000 (para proxy HTTP)
===========================================
Servidor Ice de Chat iniciado
TCP endpoint: tcp -p 5000 (para proxy HTTP)
WebSocket endpoint: ws://localhost:10000 (para frontend)
===========================================
```

### Paso 2: Iniciar el Proxy HTTP

```bash
cd proxy-http
npm install
npm start
```

**Output esperado:**
```
===========================================
Proxy HTTP en puerto 3000
WebSocket server activo en ws://localhost:3000
===========================================
🔌 Ice Bridge configurado para TCP en puerto 5000
✅ Proxy listo - usando ZeroC Ice RPC
===========================================
```

### Paso 3: Iniciar el Cliente Web

```bash
cd cliente-web
npm install
npm run build
npm run serve
```

**Output esperado:**
```
   ┌──────────────────────────────────────────┐
   │   Serving!                               │
   │   - Local:    http://localhost:8080      │
   └──────────────────────────────────────────┘
```

### Paso 4: Usar la Aplicación

1. Abrir `http://localhost:8080` en el navegador
2. Ingresar nombre de usuario cuando se solicite
3. ¡Listo para chatear!

---

## ⚡ Funcionalidades

### ✅ Mensajería de Texto
- Enviar mensajes a usuarios individuales
- Enviar mensajes a grupos
- Historial persistente de conversaciones
- Actualización en tiempo real via WebSocket
- Mensajes aparecen inmediatamente cuando estás dentro del chat

### ✅ Grupos de Chat
- Crear grupos con nombre personalizado
- Enviar mensajes a todos los miembros
- Lista de grupos actualizada en tiempo real

### ✅ Notas de Voz
- Grabar audio desde el micrófono
- Enviar audio codificado en Base64
- Reproductor de audio integrado en el chat
- Soporte para múltiples formatos (webm, ogg, mp4)

### ✅ Llamadas de Voz
- Llamadas P2P usando WebRTC
- Señalización via WebSocket del proxy
- Indicador visual de llamada en curso
- Timer de duración de llamada
- Audio bidireccional en tiempo real

---

## ⚙️ Configuración Avanzada

### Cambiar Hosts/Puertos

**Servidor Java** (`IceChatServer.java`):
```java
// Puerto Ice WebSocket
"ws -h localhost -p 10000"

// Puerto TCP
new ChatServer(5000)
```

**Proxy HTTP** (`services/iceBridge.js`):
```javascript
this.SERVER_HOST = 'localhost';
this.SERVER_PORT = 5000;
```

**Cliente Web** (`src/chat.js`):
```javascript
this.API_URL = 'http://localhost:3000';
this.WS_URL = 'ws://localhost:3000';
```

### Acceso desde otra máquina

1. Cambiar `localhost` por la IP del servidor en todos los archivos mencionados
2. Asegurarse de que los puertos estén abiertos en el firewall
3. Usar HTTPS/WSS en producción

---
