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

