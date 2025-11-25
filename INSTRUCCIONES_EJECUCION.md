# Instrucciones de Ejecución - Chat RPC

## Requisitos

- **Java 17+** con Gradle
- **Node.js 18+** con npm
- **ZeroC Ice** (opcional, para endpoints Ice)

## Arquitectura

```
┌─────────────────┐     HTTP/WS      ┌─────────────────┐     TCP/5000     ┌─────────────────┐
│   Cliente Web   │ ←──────────────→ │   Proxy HTTP    │ ←──────────────→ │  Servidor Java  │
│   (Webpack)     │    :3000         │   (Express+WS)  │                  │    (Ice RPC)    │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
```

## Paso 1: Iniciar el Servidor Java

```bash
cd servidor-java

# Windows
gradlew.bat run

# Linux/Mac
./gradlew run
```

El servidor iniciará en:
- **Puerto 5000**: TCP para el proxy HTTP
- **Puerto 10000**: WebSocket para clientes Ice directos

## Paso 2: Iniciar el Proxy HTTP

```bash
cd proxy-http

# Instalar dependencias
npm install

# Iniciar el proxy
npm start
```

El proxy estará disponible en:
- **http://localhost:3000**: API REST
- **ws://localhost:3000**: WebSocket para tiempo real

## Paso 3: Compilar y Servir el Cliente Web

```bash
cd cliente-web

# Instalar dependencias
npm install

# Compilar con Webpack
npm run build

# Servir el cliente
npm run serve
```

El cliente estará disponible en **http://localhost:3000** (si usas serve) o **http://localhost:5000**

## Funcionalidades Implementadas

### ✅ Requerimientos Funcionales

| Funcionalidad | Estado | Descripción |
|--------------|--------|-------------|
| Crear grupos de chat | ✅ | Vía RPC `createGroup` |
| Enviar mensajes de texto | ✅ | Tiempo real vía WebSocket |
| Visualizar historial | ✅ | Mensajes de texto y audio |
| Notas de voz | ✅ | Grabación y envío vía WebSocket |
| Llamadas | ✅ | Notificación vía WebSocket + WebRTC |

### ✅ Requerimientos Técnicos

| Requisito | Estado | Implementación |
|-----------|--------|----------------|
| HTML, CSS, JS Vanilla | ✅ | Sin frameworks |
| Webpack | ✅ | Empaquetado del cliente |
| RPC (ZeroC Ice) | ✅ | Servidor Java con endpoints Ice |
| HTTP Express | ✅ | Proxy HTTP con endpoints REST |
| WebSocket | ✅ | Tiempo real para mensajes y llamadas |

## Endpoints del Proxy HTTP

### API REST

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/register` | Registrar usuario |
| POST | `/createGroup` | Crear grupo |
| POST | `/sendMessage` | Enviar mensaje de texto |
| POST | `/sendVoiceNote` | Enviar nota de voz |
| POST | `/startCall` | Iniciar llamada |
| POST | `/getHistory` | Obtener historial |
| POST | `/getUsers` | Listar usuarios |
| POST | `/getGroups` | Listar grupos |

### WebSocket

Conectar a `ws://localhost:3000`

**Mensajes entrantes:**
```json
{ "type": "register", "username": "nombre" }
```

**Mensajes salientes:**
```json
{ "type": "newMessage", "message": {...} }
{ "type": "incomingCall", "from": "usuario", "to": "destinatario" }
{ "type": "groupCreated", "groupName": "nombre" }
```

## Flujo de Comunicación

1. **Registro de usuario**: Cliente → Proxy → Servidor Java
2. **Conexión WebSocket**: Cliente ↔ Proxy (tiempo real)
3. **Envío de mensaje**: Cliente → Proxy → Servidor → Proxy → WebSocket → Clientes
4. **Nota de voz**: Grabación → Base64 → Proxy → Servidor → Historial
5. **Llamadas**: Notificación vía WebSocket + MediaStream local

## Notas Técnicas

- Los mensajes se almacenan en `data/history.json`
- Los audios se guardan en Base64 dentro del historial
- El polling de usuarios se realiza cada 10 segundos
- La reconexión WebSocket es automática (hasta 5 intentos)
