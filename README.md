# Chat Parte 2 - Cliente HTTP y comunicación mediante Proxy 
## Integrantes
- Santiago Carlosama
- Joshua Sayur
- Paula Andrea Piedrahita
- Jean Carlo Ocampo

## Características

Mensajería privada: Envío de mensajes de texto entre usuarios

Grupos de chat: Creación y gestión de grupos de conversación

Historial: Registro automático de todas las conversaciones

## Orden, comandos e instrucciones para usar chatme
### Nota: cada paso debe realizarse en un bash diferente desde la raiz del proyecto

### 1 Cómo ejecutar el servidor backend de java 
```bash
cd servidor-java
./gradlew build
java -jar .\build\libs\servidor-java-1.0-SNAPSHOT.jar
```
### 2 Cómo ejecutar el proxy  
```bash
cd proxy-http
npm install
node index.js
```

### 3 Cómo ejecutar el frontend   
```bash
cd cliente-web
npm install
npx serve .
```

### 4 Abrir un navegador 
Al ejecutar el paso 3, la consola nos indicará en qué dirección esta corriendo el servidor web estático.

### 5 Usar Chatme
Al ingresar verá los usuarios disponibles y los grupos que estén creados.
- Si desea chatear con algún usuario, haga click sobre el nombre o icono que está en la izquierda y se le desplegara un chat;
    Escriba su mensaje y envieselo.
- Si desea chatear en algún grupo, haga click sobre el nombre o icono del grupo que está en la izquierda y se le desplegara un chat;
    Escriba su mensaje y envielo.
- Si desea crear un grupo, escriba el nombre del grupo en el apartado Nombre del Grupo y haga click en Crear, después podrá ver el grupo
en *Grupos*

### Notas

Puede abrir tantas ventanas como desee en la misma maquina donde esté ejecutando el backend y el proxy, cada una será "independiente" y
representará un "usuario" "diferente". Sin embargo, si quiere acceder desde otra maquina debe tener en cuenta las siguientes consideraciones:
- 1. Conocer la dirección IP de la maquina donde ejecutará el proxy y el frontend.
- 2. Antes de ejecutar el proxy, cambiar, en el archivo proxy-http/services/chatDelegate.js, la siguiente linea:
```ts
const SERVER_HOST = 'localhost';
```
por
```ts
const SERVER_HOST = '(ip de la maquina donde ejecutará el proxy)';
```
- 3. Antes de ejecutar el front, cambiar, en el archivo cliente-web/chat.js, la siguiente linea:

```ts
this.API_URL = 'http://localhost:3000';
```
por
```ts
this.API_URL = 'http://(ip de la maquina donde ejecutará el server front estatico):3000';
```
- 4. Ya puede ejecutar los pasos del 1 al 3 con normalidad

De esta manera, podrá, desde otra maquina, acceder a la dirección que le indique la consola cuando realice el paso 3.

**Flujo de Comunicación entre Cliente, Proxy y Backend**

El sistema de chat sigue una arquitectura de tres capas donde cada componente tiene responsabilidades específicas que se integran para proporcionar una experiencia de chat en tiempo real.

**Flujo Principal de Comunicación**

**Cliente Web (Frontend) ↔ Proxy HTTP (Middleware) ↔ Backend Java (Servidor Socket)**

El Cliente Web (interfaz de usuario en navegador) se comunica exclusivamente mediante peticiones HTTP REST con el Proxy HTTP (Node.js/Express), que actúa como intermediario convirtiendo estas peticiones en conexiones de socket TCP con el Backend Java, donde reside toda la lógica del negocio y gestión de estado.

**Secuencia Operativa Integrada**

**1. Ciclo de Registro y Conexión**

- El usuario ingresa su nombre en el cliente web
- El frontend envía POST /register al proxy con el username
- El proxy establece conexión socket con el backend Java enviando {"action":"REGISTER","username":"X"}
- El backend registra al usuario en sus mapas internos y responde confirmación
- Simultáneamente, el backend notifica a todos los clientes conectados para actualizar las listas de usuarios

**2. Gestión de Conversaciones**

- **Para chats privados**: Cuando un usuario selecciona otro usuario, el frontend inicia polling cada 2 segundos a /getHistory
- **Para grupos**: Similar proceso pero marcando isGroup:true
- El backend calcula la clave de historial (combinación ordenada de usuarios para privados, nombre del grupo para grupales)
- Los mensajes se almacenan en memoria y se recuperan bajo demanda

**3. Envío de Mensajes en Tiempo Real**

- **Mensajes privados**:
  - Cliente A → Proxy → Backend → Cliente B (destinatario) + Cliente A (confirmación)
- **Mensajes grupales**:
  - Cliente → Proxy → Backend → Todos los clientes conectados
- El backend mantiene historial simétrico para conversaciones privadas y broadcast para grupales

**4. Sincronización de Estado**

- Polling automático cada 5 segundos para actualizar listas de usuarios y grupos
- Notificaciones push cuando ocurren eventos (nuevos grupos, usuarios que se conectan/desconectan)
- El backend ejecuta broadcasts automáticos ante cambios de estado

**Protocolos y Adaptación**

**Del Frontend al Proxy**: Comunicación HTTP REST estándar

javascript

*// Ejemplo: Frontend → Proxy*

POST /sendMessage

{

`  `"from": "usuarioA",

`  `"to": "usuarioB", 

`  `"message": "Hola",

`  `"isGroup": false

}

**Del Proxy al Backend**: Mensajes JSON sobre sockets TCP

json

*// Ejemplo: Proxy → Backend*

{"action":"SEND\_MESSAGE","from":"usuarioA","to":"usuarioB","message":"Hola","isGroup":false}

**Respuestas del Backend**: JSON con estructura consistente

json

*// Éxito*

{"action":"MESSAGE\_SENT","timestamp":"..."}

*// Error*  

{"error":"Descripción del error"}

**Características Clave del Flujo**

- **Separación de responsabilidades**: Cada capa tiene una función específica
- **Adaptación de protocolos**: El proxy convierte HTTP a sockets TCP
- **Estado en memoria**: El backend Java mantiene todo el estado de la aplicación
- **Comunicación bidireccional**: Aunque el frontend usa HTTP, simula tiempo real mediante polling
- **Gestión de concurrencia**: Backend Java usa ExecutorService y Semaphore para manejar múltiples clientes

Este diseño permite que el frontend web se comunique eficientemente con un backend de sockets a través de un proxy que realiza la necesaria traducción de protocolos, manteniendo la escalabilidad y responsividad del sistema de chat.
