package com.chat.servidor;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class ClientHandler implements Runnable {

    private Socket socket;
    private PrintWriter out;
    private BufferedReader in;
    private ChatServer server;
    private String clientId;

    public ClientHandler(Socket socket, ChatServer server) {
        this.socket = socket;
        this.server = server;
        this.clientId = socket.getInetAddress().toString() + ":" + socket.getPort();
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);

            ChatServer.getClientesConectados().put(clientId, this);
            System.out.println("Cliente registrado: " + clientId);

            String message;
            while ((message = in.readLine()) != null) {
                System.out.println("[" + clientId + "] Mensaje recibido: " + message);
                handleMessage(message);
            }

        } catch (IOException e) {
            System.err.println("Error con cliente " + clientId + ": " + e.getMessage());
        } finally {
            cleanup();
        }
    }

    /**
     * Procesa los mensajes recibidos del cliente
     * Implementar lógica para:
     * - CREATE_GROUP: Crear grupos de chat
     * - SEND_MESSAGE: Enviar mensajes a usuarios/grupos
     * - GET_HISTORY: Obtener historial de mensajes
     * 
     * Formato esperado de mensajes JSON:
     * {"action":"CREATE_GROUP","groupName":"nombre"}
     * {"action":"SEND_MESSAGE","from":"user1","to":"user2","message":"hola"}
     * {"action":"GET_HISTORY","target":"user1"}
     */
    private void handleMessage(String message) {
        try {
            if (message.contains("\"action\":\"CREATE_GROUP\"")) {
                
            } else if (message.contains("\"action\":\"SEND_MESSAGE\"")) {
    
            } else { //También debemos implementar lo del historial/registro de mensajes tipo Wpp
                
            }

        } catch (Exception e) {
            enviarRespuesta("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }

    /**
     * Envía una respuesta al cliente
     */
    private void enviarRespuesta(String respuesta) {
        if (out != null) {
            out.println(respuesta);
            out.flush();
        }
    }

    /**
     * Implementar metodo para crear grupos
     * Debe extraer "groupName" del mensaje JSON y agregarlo a ChatServer.getGrupos()
     */
    // private void handleCreateGroup(String message) { }

    /**
     * Implementar método para enviar mensajes
     * Debe extraer "from", "to", "message" y guardar en ChatServer.getHistorial()
     */
    // private void handleSendMessage(String message) { }

    /**
     * Implementar método para obtener historial
     * Debe extraer "target" y retornar mensajes de ChatServer.getHistorial()
     */
    // private void handleGetHistory(String message) { }
    
    /**
     * Metodo auxiliar para extraer valores de JSON
     * Ejemplo: extractValue("{\"key\":\"value\"}", "key") -> "value"
     */
    private String extractValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":\"";
            int start = json.indexOf(searchKey);
            if (start == -1) return null;
            
            start += searchKey.length();
            int end = json.indexOf("\"", start);
            if (end == -1) return null;
            
            return json.substring(start, end);
        } catch (Exception e) {
            return null;
        }
    }

    private void cleanup() {
        try {
            ChatServer.getClientesConectados().remove(clientId);
            ChatServer.getSemaphore().release();
            
            if (in != null) in.close();
            if (out != null) out.close();
            if (socket != null && !socket.isClosed()) socket.close();
            
            System.out.println("Cliente desconectado: " + clientId);
        } catch (IOException e) {
            System.err.println("Error al cerrar conexión: " + e.getMessage());
        }
    }
}