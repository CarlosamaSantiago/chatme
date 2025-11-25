# Configuración de ICE para ChatMe

Este proyecto utiliza ZeroC Ice para la comunicación entre el servidor Java y el cliente web JavaScript.

## Pasos para configurar ICE

### 1. Instalar dependencias del cliente

```bash
cd cliente-web
npm install
```

### 2. Generar archivos JavaScript desde Chat.ice

Primero, necesitas compilar el servidor Java para generar las clases Java desde Chat.ice:

```bash
cd servidor-java
./gradlew build
```

Luego, genera los archivos JavaScript desde el archivo Chat.ice:

```bash
cd cliente-web
npx slice2js ../servidor-java/Chat.ice
```

Esto generará el archivo `Chat.js` en el directorio actual.

### 3. Copiar archivos necesarios

Crea el directorio `extLibs` si no existe y copia los archivos necesarios:

```bash
mkdir -p cliente-web/extLibs
cp cliente-web/Chat.js cliente-web/extLibs/
```

También necesitas copiar `Ice.js` desde el paquete npm de ice. Puedes encontrarlo en:
- `node_modules/ice/lib/Ice.js` (o similar según la versión)

O descargarlo desde: https://github.com/zeroc-ice/ice/tree/v3.7.9/js/src/Ice

### 4. Estructura de archivos esperada

```
cliente-web/
  ├── extLibs/
  │   ├── Ice.js
  │   └── Chat.js
  ├── services/
  │   ├── iceDelegate.js
  │   └── subscriber.js
  ├── chat.js
  ├── index.html
  └── package.json
```

## Ejecutar el proyecto

### Servidor

```bash
cd servidor-java
./gradlew run
```

El servidor ICE se iniciará en el puerto 9099 (WebSocket).

### Cliente

```bash
cd cliente-web
npx serve .
```

Abre el navegador en `http://localhost:3000` (o el puerto que indique serve).

## Notas

- El servidor ICE corre en el puerto 9099 usando WebSocket
- El servidor de sockets original (puerto 5000) sigue disponible para compatibilidad
- Los mensajes se notifican en tiempo real usando el patrón Observer de ICE

