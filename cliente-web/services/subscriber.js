class Subscriber extends Chat.Observer {
    notifyMessage(msg) {
        console.log("Mensaje del servidor: ", msg);
    }

    notifyNewUser(username) {
        console.log("Nuevo usuario registrado: ", username);
        // Disparar evento personalizado para actualizar la UI
        window.dispatchEvent(new CustomEvent('newUser', { detail: username }));
    }

    notifyNewGroup(groupName) {
        console.log("Nuevo grupo creado: ", groupName);
        // Disparar evento personalizado para actualizar la UI
        window.dispatchEvent(new CustomEvent('newGroup', { detail: groupName }));
    }

    notifyNewMessage(message) {
        console.log("Nuevo mensaje recibido: ", message);
        // Disparar evento personalizado para actualizar la UI
        window.dispatchEvent(new CustomEvent('newMessage', { detail: message }));
    }
}

export default new Subscriber();

