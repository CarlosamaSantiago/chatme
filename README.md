# chatme
Chat Parte 2 - Cliente HTTP y comunicación mediante Proxy

## Integrantes
- Santiago Carlosama
- Joshua Sayur
- Paula Andrea Piedrahita
- Jean Carlo Ocampo

## Estado actual
Servidor TCP iniciando correctamente
Manejo de conexiones con Thread Pool
Semáforo limitando clientes simultáneos
Lógica de procesamiento de mensajes (pendiente)

## Tareas pendientes para el equipo

### 1. Completar ClientHandler.java
- Implementar `handleCreateGroup()`
- Implementar `handleSendMessage()`

### 2. Crear proxy HTTP (Node.js/Express)
Carpeta: `proxy-http/`
- Configurar Express
- Endpoints: POST /api/groups, POST /api/messages, GET /api/messages/:target
- Conectar con servidor Java vía sockets TCP

### 3. Crear cliente web
Carpeta: `cliente-web/`
- HTML con formularios
- CSS para diseño
- JavaScript para llamadas a la API/proxy

## Cómo ejecutar
```bash
cd servidor-java
./gradlew build
java -jar .\build\libs\servidor-java-1.0-SNAPSHOT.jar
```

## Formato de mensajes esperados

### Crear grupo:
```json
{"action":"CREATE_GROUP","groupName":"Grupo1"}
```

### Enviar mensaje:
```json
{"action":"SEND_MESSAGE","from":"user1","to":"Grupo1","message":"Hola"}
```
