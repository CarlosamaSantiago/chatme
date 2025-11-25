# Guía de Ejecución - ChatMe con ICE

Esta guía explica cómo ejecutar el proyecto ChatMe con ICE implementado.

## Requisitos previos

- Java JDK 8 o superior
- Node.js y npm instalados
- Gradle (o usar gradlew incluido)

## Paso 1: Instalar dependencias del cliente

```bash
cd cliente-web
npm install
```

## Paso 2: Compilar el servidor Java

Esto generará las clases Java desde `Chat.ice`:

```bash
cd servidor-java
./gradlew build
```

En Windows:
```bash
cd servidor-java
gradlew.bat build
```

## Paso 3: Generar archivos JavaScript para el cliente

Necesitas generar `Chat.js` desde `Chat.ice`:

```bash
cd cliente-web
npx slice2js ../servidor-java/Chat.ice
```

Esto creará el archivo `Chat.js` en el directorio `cliente-web`.

## Paso 4: Preparar archivos Ice.js y Chat.js

Crea el directorio `extLibs` y copia los archivos necesarios:

```bash
cd cliente-web
mkdir extLibs

# Copiar Chat.js generado
cp Chat.js extLibs/

# Copiar Ice.js desde node_modules
# La ruta puede variar según la versión, busca en:
cp node_modules/ice/lib/Ice.js extLibs/
# O si está en otra ubicación:
# cp node_modules/ice/dist/Ice.js extLibs/
```

**Nota:** Si no encuentras `Ice.js` en node_modules, puedes:
1. Buscar en `node_modules/ice/` la ubicación del archivo
2. O descargarlo desde: https://github.com/zeroc-ice/ice/tree/v3.7.9/js/src/Ice

## Paso 5: Ejecutar el servidor

En una terminal:

```bash
cd servidor-java
./gradlew run
```

En Windows:
```bash
cd servidor-java
gradlew.bat run
```

Deberías ver:
```
===========================================
Servidor de Chat iniciado en puerto 5000
===========================================
Servidor ICE iniciado en puerto 9099 (WebSocket)
```

El servidor estará escuchando en:
- Puerto 5000: Servidor de sockets original (compatibilidad)
- Puerto 9099: Servidor ICE con WebSocket

## Paso 6: Ejecutar el cliente web

En otra terminal:

```bash
cd cliente-web
npx serve .
```

O si prefieres especificar el puerto:

```bash
npx serve . -p 8080
```

Deberías ver algo como:
```
   ┌─────────────────────────────────────┐
   │   Serving!                           │
   │                                     │
   │   Local:  http://localhost:3000     │
   │                                     │
   └─────────────────────────────────────┘
```

## Paso 7: Abrir en el navegador

Abre tu navegador y ve a la URL que muestra `serve` (generalmente `http://localhost:3000`).

## Verificación

1. Al abrir la aplicación, te pedirá ingresar un nombre de usuario
2. Deberías ver la lista de usuarios y grupos
3. Puedes crear grupos y enviar mensajes
4. Las notificaciones en tiempo real deberían funcionar sin necesidad de recargar

## Solución de problemas

### Error: "Cannot find module 'ice'"
```bash
cd cliente-web
npm install
```

### Error: "Chat is not defined" en el navegador
- Verifica que `extLibs/Chat.js` existe
- Verifica que `extLibs/Ice.js` existe
- Abre la consola del navegador (F12) para ver errores específicos

### Error: "slice2js no se encuentra"
```bash
cd cliente-web
npm install --save-dev slice2js
npx slice2js ../servidor-java/Chat.ice
```

### El servidor no inicia
- Verifica que el puerto 9099 no esté en uso
- Verifica que Java esté instalado: `java -version`
- Verifica que Gradle funcione: `./gradlew --version`

### Errores de compilación en Java
- Asegúrate de haber ejecutado `./gradlew build` primero
- Los errores del IDE son normales hasta compilar

## Estructura de archivos esperada

```
chatme/
├── servidor-java/
│   ├── Chat.ice
│   ├── build.gradle
│   ├── gradlew (o gradlew.bat en Windows)
│   └── src/
│       └── main/
│           └── java/
│               └── com/chat/servidor/
│                   ├── ChatServer.java
│                   ├── controllers/
│                   │   └── ICEController.java
│                   └── services/
│                       ├── ServicesImpl.java
│                       ├── ServiceIceImpl.java
│                       └── SubjectImpl.java
└── cliente-web/
    ├── extLibs/
    │   ├── Ice.js
    │   └── Chat.js
    ├── services/
    │   ├── iceDelegate.js
    │   └── subscriber.js
    ├── chat.js
    ├── index.html
    ├── package.json
    └── chat.css
```

## Comandos rápidos (resumen)

```bash
# 1. Instalar dependencias cliente
cd cliente-web && npm install

# 2. Compilar servidor
cd ../servidor-java && ./gradlew build

# 3. Generar Chat.js
cd ../cliente-web && npx slice2js ../servidor-java/Chat.ice

# 4. Preparar extLibs
mkdir -p extLibs && cp Chat.js extLibs/ && cp node_modules/ice/lib/Ice.js extLibs/

# 5. Ejecutar servidor (terminal 1)
cd ../servidor-java && ./gradlew run

# 6. Ejecutar cliente (terminal 2)
cd ../cliente-web && npx serve .
```

