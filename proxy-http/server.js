const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use(express.static('../cliente-web'));

const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
    console.log('Cliente conectado al proxy WebSocket');
    
    const javaWs = new WebSocket('ws://localhost:5000');
    
    javaWs.on('open', function open() {
        console.log('Conectado al servidor Java');
    });
    
    javaWs.on('message', function message(data) {
        console.log('Recibido del servidor Java:', data.toString());
        ws.send(data.toString());
    });
    
    javaWs.on('error', function error(err) {
        console.error('Error en conexión con servidor Java:', err);
        ws.send(JSON.stringify({ error: "Error de conexión con el servidor" }));
    });
    
    javaWs.on('close', function close() {
        console.log('Conexión con servidor Java cerrada');
    });
    
    ws.on('message', function message(data) {
        console.log('Recibido del cliente:', data.toString());
        if (javaWs.readyState === WebSocket.OPEN) {
            javaWs.send(data.toString());
        }
    });
    
    ws.on('close', function close() {
        console.log('Cliente desconectado del proxy');
        if (javaWs.readyState === WebSocket.OPEN) {
            javaWs.close();
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Proxy HTTP/WebSocket ejecutándose en http://localhost:${PORT}`);
});