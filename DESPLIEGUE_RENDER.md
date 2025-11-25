# 🚀 Guía de Despliegue en Render

Esta guía te ayudará a desplegar ChatMe en Render paso a paso.

## 📋 Requisitos Previos

1. Cuenta en [Render.com](https://render.com) (gratis)
2. Repositorio en GitHub/GitLab/Bitbucket
3. Todos los cambios del proyecto commiteados

---

## 🔧 Paso 1: Preparar el Repositorio

1. Asegúrate de que todos los archivos estén commiteados:
   ```bash
   git add .
   git commit -m "Preparar para despliegue en Render"
   git push
   ```

2. Verifica que el archivo `render.yaml` esté en la raíz del proyecto

---

## 🎯 Paso 2: Crear Servicios en Render

### Opción A: Usar Blueprint (Recomendado - Más Fácil)

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Click en **"New +"** → **"Blueprint"**
3. Conecta tu repositorio de GitHub
4. Render detectará automáticamente el archivo `render.yaml`
5. Click en **"Apply"** para crear los 3 servicios automáticamente

### Opción B: Crear Servicios Manualmente

#### 2.1. Servidor Java (Backend)

1. **New +** → **Web Service**
2. Conecta tu repositorio
3. Configuración:
   - **Name**: `chatme-java-server`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `servidor-java/Dockerfile`
   - **Docker Context**: `servidor-java`
   - **Build Command**: (dejar vacío, Docker lo maneja)
   - **Start Command**: (dejar vacío, Docker lo maneja)

4. **Variables de Entorno**:
   - `PORT` = `10000`
   - `ICE_HOST` = `0.0.0.0`

5. **Plan**: Free
6. Click **"Create Web Service"**

#### 2.2. Proxy HTTP (Node.js)

1. **New +** → **Web Service**
2. Conecta el mismo repositorio
3. Configuración:
   - **Name**: `chatme-proxy`
   - **Environment**: `Node`
   - **Root Directory**: `proxy-http`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Variables de Entorno**:
   - `PORT` = (Render lo asignará automáticamente)
   - `ICE_SERVER_HOST` = (URL interna del servicio Java - ver abajo)
   - `ICE_SERVER_PORT` = `10000`

5. **Plan**: Free
6. Click **"Create Web Service"**

**⚠️ IMPORTANTE**: Para obtener `ICE_SERVER_HOST`:
- Después de crear el servicio Java, ve a su configuración
- En la sección **"Internal Networking"**, copia la URL interna
- O usa el formato: `chatme-java-server.onrender.com` (URL pública)
- O mejor aún, usa la URL interna si Render la proporciona

#### 2.3. Cliente Web (Frontend)

1. **New +** → **Static Site**
2. Conecta el mismo repositorio
3. Configuración:
   - **Name**: `chatme-frontend`
   - **Root Directory**: `cliente-web`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Variables de Entorno** (opcional):
   - `REACT_APP_API_URL` = (URL pública del proxy)

5. **Plan**: Free
6. Click **"Create Static Site"**

---

## 🔗 Paso 3: Configurar Networking

### 3.1. Obtener URLs de los Servicios

1. Ve a cada servicio en Render
2. Anota las URLs públicas:
   - **Java Server**: `https://chatme-java-server.onrender.com`
   - **Proxy**: `https://chatme-proxy.onrender.com`
   - **Frontend**: `https://chatme-frontend.onrender.com`

### 3.2. Actualizar Variables de Entorno

#### En el servicio Proxy (`chatme-proxy`):

1. Ve a **Environment** → **Environment Variables**
2. Actualiza `ICE_SERVER_HOST` con la URL del servicio Java:
   ```
   ICE_SERVER_HOST=chatme-java-server.onrender.com
   ```
   O si Render proporciona networking interno, usa esa URL.

#### En el servicio Frontend (`chatme-frontend`):

1. Opción 1: Usar meta tags en `index.html` (recomendado)
   - Agrega esto en el `<head>`:
   ```html
   <meta name="api-url" content="https://chatme-proxy.onrender.com">
   <meta name="ws-url" content="wss://chatme-proxy.onrender.com">
   ```

2. Opción 2: Variable de entorno
   - `REACT_APP_API_URL` = `https://chatme-proxy.onrender.com`

---

## 📝 Paso 4: Modificar index.html del Cliente

Edita `cliente-web/index.html` y agrega los meta tags:

```html
<head>
    <!-- ... otros meta tags ... -->
    <meta name="api-url" content="https://chatme-proxy.onrender.com">
    <meta name="ws-url" content="wss://chatme-proxy.onrender.com">
</head>
```

**Nota**: Reemplaza `chatme-proxy.onrender.com` con la URL real de tu servicio proxy.

---

## 🚀 Paso 5: Desplegar

1. Render comenzará a construir automáticamente cada servicio
2. Puedes ver el progreso en los **Logs** de cada servicio
3. Espera a que todos los servicios estén **Live** (verde)

---

## ✅ Paso 6: Verificar Despliegue

1. Abre la URL del frontend: `https://chatme-frontend.onrender.com`
2. Verifica los logs de cada servicio:
   - **Java Server**: Debe mostrar "Servidor Ice de Chat iniciado"
   - **Proxy**: Debe mostrar "Proxy HTTP en puerto X" y "Conectado a Ice"
   - **Frontend**: Debe cargar la aplicación

---

## 🔧 Solución de Problemas

### Problema 1: El proxy no puede conectar al servidor Java

**Solución**:
- Verifica que `ICE_SERVER_HOST` tenga la URL correcta
- Asegúrate de que el servidor Java esté **Live**
- Revisa los logs del servidor Java para ver si está escuchando

### Problema 2: El frontend no puede conectar al proxy

**Solución**:
- Verifica que los meta tags en `index.html` tengan las URLs correctas
- Asegúrate de usar `https://` y `wss://` (no `http://` y `ws://`)
- Verifica que el proxy esté **Live**

### Problema 3: Error de build en Java

**Solución**:
- Verifica que ZeroC Ice esté instalado en el Dockerfile
- Revisa los logs de build para ver errores específicos
- Asegúrate de que los archivos `.ice` estén compilados

### Problema 4: WebSocket no funciona

**Solución**:
- Render requiere `wss://` (WebSocket seguro) en producción
- Verifica que el proxy esté configurado para aceptar conexiones WebSocket
- Revisa los logs del proxy para errores de WebSocket

---

## 📊 Estructura de URLs en Render

```
Frontend (Estático):
https://chatme-frontend.onrender.com
  ↓ (HTTP/WebSocket)
Proxy (Node.js):
https://chatme-proxy.onrender.com
  ↓ (Ice RPC WebSocket)
Java Server (Backend):
https://chatme-java-server.onrender.com:10000
```

---

## 💡 Tips Adicionales

1. **Auto-Deploy**: Render despliega automáticamente cuando haces push a la rama principal
2. **Logs**: Usa los logs en tiempo real para debuggear
3. **Variables de Entorno**: Puedes cambiar variables sin redeployar
4. **Health Checks**: Render verifica automáticamente que los servicios estén funcionando
5. **Free Tier**: Los servicios gratuitos se "duermen" después de 15 minutos de inactividad

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando en Render. Si tienes problemas, revisa los logs de cada servicio y verifica las variables de entorno.

