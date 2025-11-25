# ChatMe - Sistema de Chat en Tiempo Real

## Integrantes
- Santiago Carlosama
- Joshua Sayur
- Paula Andrea Piedrahita
- Jean Carlo Ocampo

## Características

- **Mensajería privada**: Envío de mensajes de texto entre usuarios
- **Grupos de chat**: Creación y gestión de grupos de conversación
- **Notas de voz**: Grabación y envío de mensajes de audio
- **Llamadas de voz**: Comunicación en tiempo real mediante WebRTC
- **Historial**: Registro automático de todas las conversaciones

---

## Instrucciones de Ejecución

El sistema está compuesto por tres componentes principales que deben ejecutarse en orden. **Cada componente debe ejecutarse en una terminal diferente** desde la raíz del proyecto.

### Prerrequisitos

- **Java JDK 8+** instalado
- **Node.js y npm** instalados
- **Gradle** (se descarga automáticamente con `./gradlew`)
- **ZeroC Ice** instalado y disponible en el PATH (para compilar archivos `.ice`)

### Paso 1: Ejecutar el Servidor Backend (Java)

El servidor Java maneja toda la lógica del negocio y puede operar en dos modos:
- **Servidor TCP Socket** (puerto 5000): Para comunicación con el proxy HTTP
- **Servidor Ice WebSocket** (puerto 10000): Para comunicación directa con clientes Ice

```bash
cd servidor-java
./gradlew build
java -jar .\build\libs\servidor-java-1.0-SNAPSHOT.jar
```

**Nota para Windows**: Si `./gradlew` no funciona, use `gradlew.bat` en su lugar.

**Verificación**: Debería ver mensajes indicando que ambos servidores están activos:
```
Servidor original iniciado en puerto 5000 (para proxy HTTP)
Servidor Ice de Chat iniciado
TCP endpoint: tcp -p 5000 (para proxy HTTP)
WebSocket endpoint: ws://localhost:10000 (para frontend)
```

### Paso 2: Ejecutar el Proxy HTTP

El proxy actúa como intermediario entre el cliente web y el servidor Java, convirtiendo peticiones HTTP REST y WebSocket a sockets TCP.

```bash
cd proxy-http
npm install
node index.js
```

**Verificación**: Debería ver:
```
Proxy HTTP en puerto 3000
WebSocket server activo en ws://localhost:3000
```

### Paso 3: Ejecutar el Frontend

El cliente web es una aplicación estática que se sirve mediante un servidor HTTP simple.

```bash
cd cliente-web
npm install
npx serve .
```

**Verificación**: La consola indicará la URL donde está corriendo (generalmente `http://localhost:3000` o `http://localhost:8080`).

### Paso 4: Abrir en el Navegador

1. Abra su navegador web
2. Navegue a la URL indicada en el paso 3
3. Ingrese su nombre de usuario cuando se le solicite
4. ¡Listo para chatear!

### Uso de la Aplicación

- **Chat privado**: Haga clic sobre el nombre o icono de un usuario en la lista izquierda para iniciar una conversación
- **Chat grupal**: Haga clic sobre el nombre o icono de un grupo para unirse a la conversación
- **Crear grupo**: Escriba el nombre del grupo en el campo "Nombre del Grupo" y haga clic en "Crear"
- **Enviar mensaje**: Escriba en el campo de texto y presione Enter o haga clic en el botón de enviar
- **Nota de voz**: Haga clic en el botón "🎤 Voz" para grabar y enviar un mensaje de audio
- **Llamada**: Haga clic en el botón "📞 Llamar" para iniciar una llamada de voz con el usuario o grupo seleccionado

---

## Configuración para Acceso Remoto

Si desea acceder al sistema desde otra máquina en la red, siga estos pasos:

### 1. Conocer la dirección IP

Obtenga la dirección IP de la máquina donde ejecutará el proxy y el frontend.

### 2. Configurar el Proxy

Edite el archivo `proxy-http/services/chatDelegate.js` y cambie:

```javascript
const SERVER_HOST = 'localhost';
```

por:

```javascript
const SERVER_HOST = 'IP_DE_LA_MAQUINA';
```

### 3. Configurar el Cliente Web

Edite el archivo `cliente-web/src/chat.js` y cambie:

```javascript
this.API_URL = 'http://localhost:3000';
this.WS_URL = 'ws://localhost:3000';
```

por:

```javascript
this.API_URL = 'http://IP_DE_LA_MAQUINA:3000';
this.WS_URL = 'ws://IP_DE_LA_MAQUINA:3000';
```

### 4. Recompilar el Frontend (si es necesario)

Si modificó el archivo fuente, recompile:

```bash
cd cliente-web
npm run build
```

### 5. Ejecutar los Componentes

Ejecute los pasos 1, 2 y 3 normalmente. Desde otra máquina, acceda a la URL que indique el servidor del frontend.

---

## Descripción del Flujo de Comunicación

El sistema utiliza una **arquitectura de tres capas** donde cada componente tiene responsabilidades específicas:

```
┌─────────────────┐
│  Cliente Web    │ (Navegador)
│  (JavaScript)   │
└────────┬────────┘
         │ HTTP REST + WebSocket
         │ (Puerto 3000)
         ▼
┌─────────────────┐
│  Proxy HTTP     │ (Node.js/Express)
│  (Middleware)   │
└────────┬────────┘
         │ TCP Socket
         │ (Puerto 5000)
         ▼
┌─────────────────┐
│ Servidor Java   │ (Backend)
│ (Lógica Negocio)│
└─────────────────┘
```

### Componentes y Protocolos

#### 1. Cliente Web (Frontend)
- **Tecnología**: JavaScript vanilla, HTML5, CSS3
- **Protocolo hacia Proxy**: 
  - **HTTP REST** para operaciones síncronas (registro, obtener historial, etc.)
  - **WebSocket** para mensajería en tiempo real y señalización WebRTC
- **Puerto**: Se conecta al puerto 3000 del proxy

#### 2. Proxy HTTP (Middleware)
- **Tecnología**: Node.js, Express, WebSocket (ws)
- **Funciones**:
  - Recibe peticiones HTTP REST del cliente
  - Mantiene conexiones WebSocket para tiempo real
  - Convierte peticiones HTTP a mensajes JSON sobre sockets TCP
  - Maneja la señalización WebRTC para llamadas de voz
- **Puertos**:
  - **3000**: HTTP REST y WebSocket (cliente → proxy)
  - **5000**: TCP Socket hacia el servidor Java (proxy → backend)

#### 3. Servidor Java (Backend)
- **Tecnología**: Java, ZeroC Ice
- **Funciones**:
  - Gestiona usuarios registrados
  - Almacena y recupera historial de mensajes
  - Gestiona grupos de chat
  - Distribuye mensajes a usuarios conectados
  - Persiste historial en archivos
- **Puertos**:
  - **5000**: TCP Socket (proxy → backend)
  - **10000**: Ice WebSocket (para clientes Ice directos, opcional)

---

## Flujo Detallado de Operaciones

### 1. Registro de Usuario

```
Cliente Web                    Proxy HTTP                  Servidor Java
     │                              │                            │
     │── POST /register ────────────>│                            │
     │   {username: "Juan"}         │                            │
     │                              │── TCP Socket ─────────────>│
     │                              │  {"action":"REGISTER",     │
     │                              │   "username":"Juan"}       │
     │                              │                            │── Registra usuario
     │                              │                            │── Actualiza listas
     │                              │<── JSON Response ──────────│
     │<── JSON Response ────────────│                            │
     │                              │                            │
     │── WebSocket: register ───────>│                            │
     │   {type:"register",          │                            │
     │    username:"Juan"}          │                            │
     │                              │── Almacena conexión ───────>│
     │<── {type:"registered"} ──────│                            │
```

### 2. Envío de Mensaje Privado

```
Cliente Web                    Proxy HTTP                  Servidor Java
     │                              │                            │
     │── POST /sendMessage ─────────>│                            │
     │   {from, to, message,        │                            │
     │    isGroup: false}           │                            │
     │                              │── TCP Socket ─────────────>│
     │                              │  {"action":"SEND_MESSAGE", │
     │                              │   "from":"Juan",           │
     │                              │   "to":"María",            │
     │                              │   "message":"Hola",        │
     │                              │   "isGroup":false}         │
     │                              │                            │── Guarda en historial
     │                              │                            │── Notifica destinatario
     │                              │<── JSON Response ──────────│
     │<── JSON Response ────────────│                            │
     │                              │                            │
     │                              │── WebSocket ───────────────>│
     │                              │  {type:"newMessage",       │
     │                              │   message:{...}}           │
     │<── WebSocket: newMessage ────│                            │
     │   (confirmación)             │                            │
     │                              │── WebSocket ───────────────>│
     │                              │  {type:"newMessage",       │
     │                              │   message:{...}}           │
     │                              │  (a María)                 │
```

### 3. Envío de Mensaje Grupal

```
Cliente Web                    Proxy HTTP                  Servidor Java
     │                              │                            │
     │── POST /sendMessage ─────────>│                            │
     │   {from, to: "Grupo1",       │                            │
     │    message, isGroup: true}   │                            │
     │                              │── TCP Socket ─────────────>│
     │                              │  {"action":"SEND_MESSAGE", │
     │                              │   "isGroup":true}          │
     │                              │                            │── Guarda en historial
     │                              │                            │── Broadcast a todos
     │                              │<── JSON Response ──────────│
     │<── JSON Response ────────────│                            │
     │                              │                            │
     │                              │── WebSocket (broadcast) ───>│
     │                              │  A todos los usuarios      │
     │<── WebSocket: newMessage ────│  conectados               │
     │   (a todos)                  │                            │
```

### 4. Obtención de Historial

```
Cliente Web                    Proxy HTTP                  Servidor Java
     │                              │                            │
     │── POST /getHistory ──────────>│                            │
     │   {target, from, isGroup}    │                            │
     │                              │── TCP Socket ─────────────>│
     │                              │  {"action":"GET_HISTORY",  │
     │                              │   "target":"María",        │
     │                              │   "from":"Juan",           │
     │                              │   "isGroup":false}         │
     │                              │                            │── Calcula clave historial
     │                              │                            │── Recupera mensajes
     │                              │<── JSON con mensajes ──────│
     │<── JSON con mensajes ────────│                            │
```

### 5. Llamada de Voz (WebRTC)

```
Cliente A                      Proxy HTTP                  Cliente B
     │                              │                            │
     │── WebSocket: call-offer ────>│                            │
     │   {type:"call-offer",        │                            │
     │    offer: SDP, to: "B"}      │                            │
     │                              │── WebSocket ───────────────>│
     │                              │  {type:"call-offer",       │
     │                              │   from:"A", offer: SDP}    │
     │                              │                            │── Usuario B acepta
     │                              │<── WebSocket: call-answer ─│
     │                              │  {type:"call-answer",      │
     │                              │   answer: SDP}             │
     │<── WebSocket: call-answer ───│                            │
     │                              │                            │
     │── WebSocket: ice-candidate ─>│                            │
     │   (candidatos ICE)           │                            │
     │                              │── WebSocket ───────────────>│
     │                              │  {type:"ice-candidate",    │
     │                              │   candidate: {...}}        │
     │                              │                            │
     │<══════════════════════════════════════════════════════════>│
     │         Conexión WebRTC P2P (directa entre A y B)         │
```

**Nota**: Una vez establecida la señalización, la comunicación de audio se realiza directamente entre los clientes mediante WebRTC, sin pasar por el servidor.

---

## Características Clave del Flujo

### Separación de Responsabilidades
- **Cliente Web**: Interfaz de usuario y experiencia del usuario
- **Proxy HTTP**: Adaptación de protocolos (HTTP/WebSocket ↔ TCP Socket)
- **Servidor Java**: Lógica de negocio y gestión de estado

### Protocolos Utilizados
- **HTTP REST**: Para operaciones síncronas (CRUD)
- **WebSocket**: Para mensajería en tiempo real y señalización WebRTC
- **TCP Socket**: Para comunicación entre proxy y backend Java
- **WebRTC**: Para llamadas de voz peer-to-peer

### Gestión de Estado
- El servidor Java mantiene todo el estado en memoria:
  - Usuarios registrados
  - Historial de mensajes
  - Grupos creados
  - Conexiones activas
- El historial se persiste automáticamente en archivos

### Comunicación en Tiempo Real
- Los mensajes se distribuyen inmediatamente mediante WebSocket
- No se requiere polling constante para recibir mensajes nuevos
- El polling se usa solo para actualizar listas de usuarios/grupos periódicamente

### Escalabilidad
- El backend Java utiliza `ExecutorService` y `Semaphore` para manejar múltiples clientes concurrentemente
- Cada conexión TCP es independiente y se cierra después de cada operación
- Las conexiones WebSocket permanecen abiertas para tiempo real

---

## Estructura del Proyecto

```
chatme/
├── cliente-web/          # Frontend (JavaScript, HTML, CSS)
│   ├── src/
│   │   ├── chat.js      # Lógica principal del cliente
│   │   └── ice-client.js # Cliente Ice (opcional)
│   ├── dist/            # Archivos compilados
│   └── package.json
│
├── proxy-http/          # Proxy HTTP/WebSocket (Node.js)
│   ├── services/
│   │   ├── chatDelegate.js  # Comunicación TCP con backend
│   │   └── iceBridge.js     # Bridge para Ice RPC
│   ├── index.js        # Servidor Express + WebSocket
│   └── package.json
│
└── servidor-java/       # Backend (Java + ZeroC Ice)
    ├── src/
    │   ├── main/
    │   │   ├── java/
    │   │   │   └── com/chat/servidor/
    │   │   │       ├── IceChatServer.java  # Servidor principal
    │   │   │       ├── ChatServer.java     # Servidor TCP original
    │   │   │       └── HistoryManager.java # Gestión de historial
    │   │   └── slice/
    │   │       └── Chat.ice                # Definición Ice
    │   └── generated/                      # Código generado por Ice
    └── build.gradle
```

---

## Notas Adicionales

- Puede abrir múltiples ventanas del navegador en la misma máquina, cada una representará un usuario diferente
- El historial se guarda automáticamente y se carga al reiniciar el servidor
- Los grupos persisten entre sesiones
- Las llamadas WebRTC requieren permisos de micrófono en el navegador
- Para producción, considere usar HTTPS/WSS en lugar de HTTP/WS

---

## Solución de Problemas

### El servidor Java no inicia
- Verifique que Java esté instalado: `java -version`
- Verifique que el puerto 5000 no esté en uso
- Asegúrese de haber compilado correctamente: `./gradlew build`

### El proxy no se conecta al servidor Java
- Verifique que el servidor Java esté ejecutándose primero
- Verifique que `SERVER_HOST` en `chatDelegate.js` sea correcto
- Revise los logs del servidor Java para errores

### El frontend no se conecta al proxy
- Verifique que el proxy esté ejecutándose
- Verifique que las URLs en `chat.js` sean correctas
- Revise la consola del navegador para errores de CORS o conexión

### Las llamadas WebRTC no funcionan
- Verifique que el navegador soporte WebRTC
- Asegúrese de haber dado permisos de micrófono
- Revise que los servidores STUN estén accesibles (puede requerir configuración de firewall)
