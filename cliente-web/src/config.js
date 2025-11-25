// Configuración dinámica basada en el entorno
const getConfig = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // En desarrollo local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return {
            API_URL: 'http://localhost:3000',
            WS_URL: 'ws://localhost:3000'
        };
    }
    
    // En producción (Render u otro hosting)
    // Usar el mismo host pero con el puerto del proxy
    // Render asigna URLs automáticamente, así que usamos el mismo dominio
    const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Si hay una variable de entorno configurada, usarla
    // De lo contrario, inferir del hostname actual
    // En Render, el proxy tendrá una URL como: chatme-proxy.onrender.com
    // El frontend tendrá: chatme-frontend.onrender.com
    // Necesitamos usar la URL del proxy
    
    // Intentar obtener la URL del API desde una variable global o meta tag
    const apiUrlMeta = document.querySelector('meta[name="api-url"]');
    const wsUrlMeta = document.querySelector('meta[name="ws-url"]');
    
    if (apiUrlMeta && wsUrlMeta) {
        return {
            API_URL: apiUrlMeta.getAttribute('content'),
            WS_URL: wsUrlMeta.getAttribute('content')
        };
    }
    
    // Fallback: usar el mismo hostname (asumiendo que el proxy está en el mismo dominio)
    // Esto funcionará si Render está configurado con el mismo dominio base
    return {
        API_URL: `${protocol}//${hostname}${port ? ':' + port : ''}`,
        WS_URL: `${wsProtocol}//${hostname}${port ? ':' + port : ''}`
    };
};

export default getConfig();

