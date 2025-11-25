# Proyecto Chat con ZeroC Ice RPC

Este proyecto ha sido migrado para usar ZeroC Ice como middleware RPC, con soporte para WebSockets para comunicación en tiempo real.

## Requisitos

### Backend (Java)
- Java 8 o superior
- Gradle
- ZeroC Ice 3.7.x (se descargará automáticamente con Gradle)

### Frontend
- Node.js 14 o superior
- npm

### Proxy HTTP
- Node.js 14 o superior
- npm

## Estructura del Proyecto

```
chatme/
├── servidor-java/          # Servidor Java con Ice
│   ├── src/main/
│   │   ├── slice/          # Definiciones Slice (.ice)
│   │   └── java/           # Código Java
│   └── build.gradle        # Configuración Gradle con Ice
├── cliente-web/            # Cliente web (HTML/CSS/JS)
│   ├── src/               # Código fuente
│   └── dist/              # Archivos empaquetados (generado)
└── proxy-http/             # Proxy HTTP que traduce a Ice RPC
```

## Instalación y Configuración

### 1. Backend Java con Ice

```bash
cd servidor-java

# PRIMERO: Compilar archivos .ice a Java
# En Linux/Mac:
./compile-ice.sh

# En Windows:
compile-ice.bat

# Luego: Instalar dependencias y compilar
./gradlew build
```

**Importante**: Para compilar los archivos `.ice`, necesitas tener el compilador `slice2java` instalado. Puedes descargarlo desde [ZeroC Ice Downloads](https://zeroc.com/downloads/ice).

Si no tienes `slice2java` instalado:
1. Descargar Ice desde el sitio oficial: https://zeroc.com/downloads/ice
2. Extraer y agregar el directorio `bin` a tu PATH
3. Ejecutar `compile-ice.sh` (Linux/Mac) o `compile-ice.bat` (Windows)
4. Luego ejecutar `./gradlew build`

### 2. Proxy HTTP

```bash
cd proxy-http
npm install
```

### 3. Frontend

```bash
cd cliente-web
npm install
npm run build  # Empaquetar con webpack
```

## Ejecución

### 1. Iniciar el Servidor Ice

```bash
cd servidor-java
./gradlew run
```

El servidor Ice se iniciará en:
- **WebSocket**: `ws://localhost:10000`
- **Puerto TCP original**: `5000` (para compatibilidad)

### 2. Iniciar el Proxy HTTP

```bash
cd proxy-http
node index.js
```

El proxy se iniciará en `http://localhost:3000`

### 3. Iniciar el Cliente Web

```bash
cd cliente-web
npm run serve
# O abrir dist/index.html en un navegador
```

## Funcionalidades Implementadas

### ✅ Requerimientos Funcionales

1. **Crear grupos de chat** - Implementado vía RPC Ice
2. **Enviar mensajes de texto** - Implementado con actualización en tiempo real vía WebSockets
3. **Visualizar historial de mensajes** - Soporta texto y audios
4. **Envío de notas de voz** - Implementado usando WebSockets y MediaRecorder API
5. **Llamadas** - Implementado (interfaz lista, requiere WebRTC para funcionalidad completa)

### ✅ Requerimientos Técnicos

1. **Cliente en HTML/CSS/JavaScript vanilla** - ✅
2. **Webpack para empaquetado** - ✅
3. **Comunicación RPC con ZeroC Ice** - ✅
4. **WebSockets para tiempo real** - ✅
5. **Conservación de lógica del servidor** - ✅

## Arquitectura

### Servidor Ice (Java)

- **Archivo Slice**: `servidor-java/src/main/slice/Chat.ice`
- **Implementación**: `servidor-java/src/main/java/com/chat/servidor/IceChatServer.java`
- **Lógica existente**: Se mantiene en `ChatServer.java` y se reutiliza

### Cliente Web

- **Código fuente**: `cliente-web/src/chat.js`
- **Empaquetado**: Webpack genera `cliente-web/dist/chat.js`
- **Comunicación**: 
  - RPC vía HTTP proxy (`/ice/*`)
  - WebSockets para notificaciones en tiempo real

### Proxy HTTP

- **Ubicación**: `proxy-http/index.js`
- **Función**: Traduce llamadas HTTP a formato compatible con el servidor Java/Ice
- **Endpoints Ice**: `/ice/registerUser`, `/ice/sendMessage`, etc.

## Notas de Implementación

### WebSockets

El servidor Ice está configurado para usar WebSockets en el puerto 10000. El cliente se conecta a este endpoint para recibir notificaciones en tiempo real.

### Notas de Voz

Las notas de voz se graban usando la API `MediaRecorder` del navegador y se envían como datos binarios al servidor a través del RPC.

### Llamadas

La funcionalidad de llamadas está implementada a nivel de interfaz. Para una implementación completa, se requeriría:
- WebRTC para comunicación peer-to-peer
- Servidor de señalización (STUN/TURN)
- Manejo de streams de audio/video

## Solución de Problemas

### Error: "slice2java no encontrado"

Instala ZeroC Ice y agrega `slice2java` a tu PATH, o modifica `build.gradle` para usar la ruta completa.

### Error de conexión WebSocket

Verifica que:
1. El servidor Ice esté ejecutándose
2. El puerto 10000 no esté bloqueado por firewall
3. El cliente esté usando la URL correcta (`ws://localhost:10000`)

### Notas de voz no funcionan

Asegúrate de:
1. Dar permisos de micrófono al navegador
2. Usar un navegador moderno que soporte MediaRecorder API
3. Verificar que el servidor esté recibiendo los datos de audio

## Próximos Pasos

Para una implementación completa, considerar:
1. Implementar WebRTC para llamadas reales
2. Agregar autenticación y seguridad
3. Implementar persistencia de datos (base de datos)
4. Agregar más tipos de mensajes (imágenes, archivos)
5. Mejorar el manejo de errores y reconexión

## Licencia

Este proyecto es para fines educativos.

