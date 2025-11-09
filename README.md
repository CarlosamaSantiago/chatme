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
Al ejeutar el paso 3, la consola nos indicará en qué dirección esta corriendo el servidor web estático.

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


### Cómo se conectan el frontend, el proxy y el backend:

Nuestra aplicación está separada en **tres capas**:

1. **Frontend (cliente-web)** – interfaz en el navegador
2. **Proxy HTTP (proxy-http)** – traduce peticiones HTTP a TCP
3. **Servidor Java (servidor-java)** – lógica del chat y manejo de conexiones

#### 1. Frontend → Proxy HTTP

* El frontend se sirve como archivos estáticos con:

  ```bash
  cd cliente-web
  npx serve .
  ```

* El archivo `chat.js` configura la URL del API:

  ```js
  this.API_URL = 'http://localhost:3000';
  ```

* Cada acción del usuario se envía al **proxy HTTP** mediante `fetch`:

  * `/register` para registrar un usuario
  * `/getUsers` para listar usuarios
  * `/getGroups` para listar grupos
  * `/createGroup` para crear grupos
  * `/sendMessage` para enviar mensajes
  * `/getHistory` para obtener historial

* Es decir, el navegador **solo habla HTTP** con el proxy en `http://localhost:3000`.
  No se conecta directamente al servidor Java.

#### 2. Proxy HTTP → Servidor Java

* El proxy está implementado con **Node.js + Express** en `proxy-http/index.js` y escucha en el puerto **3000**:

  ```bash
  cd proxy-http
  npm install
  node index.js
  ```

* Cada endpoint del proxy toma la petición HTTP del frontend y la convierte en un mensaje JSON con un campo `action`, por ejemplo:

  ```json
  { "action": "REGISTER", "username": "Paula" }
  { "action": "SEND_MESSAGE", "from": "A", "to": "B", "message": "Hola" }
  ```

* Ese JSON se envía al servidor Java usando **TCP** desde `chatDelegate.js`:

  ```js
  const SERVER_HOST = 'localhost';
  const SERVER_PORT = 5000;
  ```

* El proxy actúa como “puente”:

  `HTTP (frontend) → JSON → TCP (servidor Java) → JSON → HTTP (respuesta al frontend)`

#### 3. Servidor Java

* El servidor Java es el backend real del chat. Se ejecuta con:

  ```bash
  cd servidor-java
  ./gradlew build
  java -jar build/libs/servidor-java-1.0-SNAPSHOT.jar
  ```

* Escucha en el puerto **5000** (debe coincidir con `SERVER_PORT` en `chatDelegate.js`).

* Recibe los JSON enviados por el proxy, interpreta el campo `action` y realiza:

  * registro de usuarios,
  * envío y distribución de mensajes,
  * manejo de grupos,
  * almacenamiento y consulta de historial.

* Devuelve una respuesta JSON al proxy, que este reenvía al frontend.

#### Esquema resumen

```text
Navegador (cliente-web)
        │  HTTP (fetch a /register, /sendMessage, etc.)
        ▼
Proxy HTTP Node (puerto 3000)
        │  TCP con mensajes JSON
        ▼
Servidor Java (puerto 5000)
```

---

4. El frontend puede servir localmente (con `npx serve .`) o desde cualquier servidor web; mientras el navegador pueda alcanzar la URL del proxy (`API_URL`), la comunicación funciona.

