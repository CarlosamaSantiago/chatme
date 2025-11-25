# ⚡ Inicio Rápido - Despliegue en Render

## 🎯 Pasos Rápidos

### 1. Preparar Repositorio
```bash
git add .
git commit -m "Preparar para Render"
git push
```

### 2. Crear Cuenta y Conectar Repo
1. Ve a [render.com](https://render.com) y crea cuenta
2. Conecta tu repositorio de GitHub

### 3. Desplegar con Blueprint (Más Fácil)
1. **New +** → **Blueprint**
2. Selecciona tu repositorio
3. Render detectará `render.yaml` automáticamente
4. Click **"Apply"**

### 4. Configurar URLs (Después del Deploy)
Una vez que los servicios estén desplegados:

1. **Anota las URLs** de cada servicio:
   - Java: `https://chatme-java-server.onrender.com`
   - Proxy: `https://chatme-proxy.onrender.com`
   - Frontend: `https://chatme-frontend.onrender.com`

2. **Actualiza `cliente-web/index.html`**:
   ```html
   <meta name="api-url" content="https://TU-PROXY-URL.onrender.com">
   <meta name="ws-url" content="wss://TU-PROXY-URL.onrender.com">
   ```

3. **Actualiza variables de entorno en Render**:
   - En el servicio **Proxy**: `ICE_SERVER_HOST` = URL del servicio Java
   - Ejemplo: `chatme-java-server.onrender.com`

4. **Haz commit y push** del cambio en `index.html`:
   ```bash
   git add cliente-web/index.html
   git commit -m "Actualizar URLs para Render"
   git push
   ```

### 5. Verificar
1. Espera a que Render termine de construir (5-10 min)
2. Abre la URL del frontend
3. ¡Listo! 🎉

---

## ⚠️ Notas Importantes

- **WebSockets**: Render requiere `wss://` (seguro) en producción
- **Free Tier**: Los servicios se "duermen" después de 15 min de inactividad
- **Primera vez**: El build puede tardar 10-15 minutos
- **Logs**: Revisa los logs si algo falla

---

## 🔧 Si Algo Falla

1. **Revisa los logs** en cada servicio
2. **Verifica variables de entorno**
3. **Asegúrate de que todos los servicios estén "Live"**
4. **Consulta `DESPLIEGUE_RENDER.md`** para más detalles

---

## 📞 URLs Finales

Después del despliegue, tendrás:
- Frontend: `https://chatme-frontend.onrender.com`
- API: `https://chatme-proxy.onrender.com`
- Backend: `https://chatme-java-server.onrender.com`

¡Éxito! 🚀

