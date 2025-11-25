# Solución de Problemas - Proyecto Chat con Ice

## Problemas Identificados y Solucionados

### 1. ✅ Archivo .ice Actualizado
El archivo `Chat.ice` fue modificado con una nueva estructura:
- `long timestamp` en lugar de `string timestamp`
- `byte[] data` en lugar de `sequence<byte> audioData`
- `sendAudio` en lugar de `sendVoiceNote`
- `MessageSeq` (secuencia) en lugar de `Message[]`
- `onGroupMessage` para mensajes de grupo

### 2. ✅ Código Java Actualizado
- `IceChatServer.java` actualizado para coincidir con la nueva estructura del .ice
- Cambios principales:
  - Uso de `long timestamp` con `System.currentTimeMillis()`
  - Método `sendAudio` en lugar de `sendVoiceNote`
  - Uso de `onGroupMessage` para notificaciones de grupo
  - Imports de `Chat.*` descomentados (requiere compilar .ice primero)

### 3. ✅ Proxy HTTP Actualizado
- `iceBridge.js` actualizado para soportar `sendAudio`
- Mantiene compatibilidad con `sendVoiceNote` como alias

### 4. ✅ Frontend Actualizado
- `chat.js` actualizado para usar `sendAudio` con parámetro `data`

## Pasos para Ejecutar el Proyecto

### Paso 1: Compilar Archivos Ice

**IMPORTANTE**: Debes tener ZeroC Ice instalado y `slice2java` en tu PATH.

```bash
cd servidor-java

# En Windows:
.\gradlew compileSlice

# En Linux/Mac:
./gradlew compileSlice
```

Si `slice2java` no está en PATH, puedes:
1. Instalar Ice desde https://zeroc.com/downloads/ice
2. Agregar el directorio `bin` de Ice a tu PATH
3. O ejecutar manualmente:
   ```bash
   slice2java --output-dir src/main/generated src/main/slice/Chat.ice
   ```

### Paso 2: Compilar Proyecto Java

```bash
cd servidor-java
.\gradlew build
```

Si hay errores de compilación:
- Verifica que los archivos en `src/main/generated/Chat/` existan
- Si no existen, ejecuta primero `compileSlice`

### Paso 3: Ejecutar Servidor Ice

```bash
cd servidor-java
.\gradlew run
```

El servidor debería iniciar en:
- **WebSocket**: `ws://localhost:10000`
- **Puerto TCP**: `5000` (para compatibilidad con proxy)

### Paso 4: Ejecutar Proxy HTTP

En otra terminal:

```bash
cd proxy-http
npm install  # Solo la primera vez
node index.js
```

El proxy debería iniciar en `http://localhost:3000`

### Paso 5: Ejecutar Cliente Web

En otra terminal:

```bash
cd cliente-web
npm install  # Solo la primera vez
npm run build
npm run serve
# O abrir dist/index.html en un navegador
```

## Errores Comunes y Soluciones

### Error: "Chat.* cannot be resolved"

**Causa**: Los archivos .ice no se han compilado.

**Solución**:
```bash
cd servidor-java
.\gradlew compileSlice
```

### Error: "slice2java not found"

**Causa**: Ice no está instalado o no está en PATH.

**Solución**:
1. Descargar Ice desde https://zeroc.com/downloads/ice
2. Extraer y agregar el directorio `bin` al PATH
3. Verificar: `slice2java --version`

### Error: "Unable to access jarfile gradle-wrapper.jar"

**Causa**: Problema con Gradle wrapper.

**Solución**:
```bash
cd servidor-java
.\gradlew wrapper --gradle-version 9.1
```

### Error: WebSocket no conecta

**Causa**: El servidor Ice no está ejecutándose.

**Solución**:
1. Verificar que `IceChatServer` esté corriendo
2. Verificar que el puerto 10000 no esté bloqueado
3. Revisar logs del servidor

### Error: "Cannot find module 'ice'"

**Causa**: Dependencias de Node.js no instaladas.

**Solución**:
```bash
cd cliente-web
npm install
```

### Error al enviar notas de voz

**Causa**: Permisos de micrófono o navegador no compatible.

**Solución**:
1. Dar permisos de micrófono al navegador
2. Usar navegador moderno (Chrome, Firefox, Edge)
3. Verificar que `MediaRecorder` esté disponible

## Verificación de Instalación

### Verificar Ice
```bash
slice2java --version
```

### Verificar Java
```bash
java -version
```

### Verificar Gradle
```bash
cd servidor-java
.\gradlew --version
```

### Verificar Node.js
```bash
node --version
npm --version
```

## Estructura de Archivos Generados

Después de compilar `.ice`, deberías tener:

```
servidor-java/
└── src/main/generated/
    └── Chat/
        ├── ChatService.java
        ├── ChatServicePrx.java
        ├── ChatException.java
        ├── Message.java
        ├── MessageCallback.java
        ├── MessageCallbackPrx.java
        └── MessageSeqHelper.java
```

Si estos archivos no existen, el proyecto no compilará.

## Notas Importantes

1. **Orden de ejecución**: Siempre compila los archivos .ice ANTES de compilar el proyecto Java
2. **Puertos**: Asegúrate de que los puertos 3000, 5000 y 10000 no estén en uso
3. **Permisos**: El navegador necesita permisos de micrófono para notas de voz
4. **CORS**: El proxy HTTP maneja CORS, pero verifica si hay problemas de conexión

## Próximos Pasos si Persisten Problemas

1. Revisar logs del servidor Java
2. Revisar consola del navegador (F12)
3. Verificar que todos los servicios estén ejecutándose
4. Verificar conectividad de red y firewalls

