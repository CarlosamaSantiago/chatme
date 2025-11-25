# Instrucciones de Ejecución - Proyecto Chat con Ice

## ⚠️ IMPORTANTE: Pasos Previos

Antes de ejecutar el proyecto, asegúrate de:

1. **Tener ZeroC Ice instalado**
   - Descargar desde: https://zeroc.com/downloads/ice
   - Agregar `bin` al PATH del sistema
   - Verificar: `slice2java --version`

2. **Compilar los archivos .ice PRIMERO**
   ```bash
   cd servidor-java
   .\gradlew compileSlice
   ```
   
   Esto generará los archivos Java en `src/main/generated/Chat/`

## 🚀 Ejecución Paso a Paso

### 1. Compilar Proyecto Java

```bash
cd servidor-java
.\gradlew build
```

Si hay errores, verifica que:
- Los archivos en `src/main/generated/Chat/` existan
- Si no existen, ejecuta `.\gradlew compileSlice` primero

### 2. Iniciar Servidor Ice

```bash
cd servidor-java
.\gradlew run
```

Deberías ver:
```
===========================================
Servidor Ice de Chat iniciado
WebSocket endpoint: ws://localhost:10000
===========================================
```

**Mantén esta terminal abierta**

### 3. Iniciar Proxy HTTP (Nueva Terminal)

```bash
cd proxy-http
npm install  # Solo la primera vez
node index.js
```

Deberías ver:
```
Proxy HTTP en puerto 3000 (con soporte Ice RPC)
```

**Mantén esta terminal abierta**

### 4. Compilar y Ejecutar Cliente Web (Nueva Terminal)

```bash
cd cliente-web
npm install  # Solo la primera vez
npm run build
npm run serve
```

O simplemente abre `cliente-web/dist/index.html` en tu navegador.

## 🔍 Verificación

1. **Servidor Ice**: Debe estar escuchando en puerto 10000 (WebSocket)
2. **Proxy HTTP**: Debe estar en puerto 3000
3. **Cliente**: Debe abrirse en el navegador

## 🐛 Si No Funciona

### Error: "Chat.* cannot be resolved"
**Solución**: Ejecuta `.\gradlew compileSlice` primero

### Error: "slice2java not found"
**Solución**: Instala Ice y agrega al PATH

### Error: "Port already in use"
**Solución**: Cierra otros procesos usando puertos 3000, 5000 o 10000

### El cliente no se conecta
**Solución**: 
1. Verifica que el servidor Ice esté corriendo
2. Verifica que el proxy HTTP esté corriendo
3. Revisa la consola del navegador (F12) para errores

## 📝 Notas

- El servidor original (puerto 5000) sigue funcionando para compatibilidad
- El servidor Ice usa WebSockets en puerto 10000
- El proxy HTTP traduce llamadas HTTP a formato compatible
- Las notas de voz requieren permisos de micrófono en el navegador

## ✅ Checklist de Ejecución

- [ ] Ice instalado y en PATH
- [ ] Archivos .ice compilados (`compileSlice`)
- [ ] Proyecto Java compilado (`build`)
- [ ] Servidor Ice ejecutándose
- [ ] Proxy HTTP ejecutándose
- [ ] Cliente web abierto en navegador
- [ ] Permisos de micrófono otorgados (para notas de voz)

