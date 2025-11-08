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
    private String username;

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

    private void handleMessage(String message) {
        try {
            if (message.contains("\"action\":\"CREATE_GROUP\"")) {
                handleCreateGroup(message);
            } else if (message.contains("\"action\":\"SEND_MESSAGE\"")) {
                handleSendMessage(message);
            } else if (message.contains("\"action\":\"GET_HISTORY\"")) {
                handleGetHistory(message);
            } else if (message.contains("\"action\":\"REGISTER\"")) {
                handleRegister(message);
            } else if (message.contains("\"action\":\"GET_USERS\"")) {
                handleGetUsers();
            } else if (message.contains("\"action\":\"GET_GROUPS\"")) {
                handleGetGroups();
            }

        } catch (Exception e) {
            enviarRespuesta("{\"error\":\"" + e.getMessage().replace("\"", "\\\"") + "\"}");
        }
    }

    private void handleRegister(String message) {
        this.username = extractValue(message, "username");
        ChatServer.getUsuarios().put(clientId, username);
        enviarRespuesta("{\"action\":\"REGISTERED\",\"username\":\"" + username + "\"}");
        
        broadcastUserList();
    }

    private void handleCreateGroup(String message) {
        String groupName = extractValue(message, "groupName");
        if (groupName != null && !groupName.trim().isEmpty()) {
            if (!ChatServer.getGrupos().containsKey(groupName)) {
                ChatServer.getGrupos().put(groupName, new ArrayList<>());
                ChatServer.getHistorial().put(groupName, new ArrayList<>());
                enviarRespuesta("{\"action\":\"GROUP_CREATED\",\"groupName\":\"" + groupName + "\"}");
                broadcastGroupList();
            } else {
                enviarRespuesta("{\"error\":\"El grupo ya existe\"}");
            }
        }
    }

    private void handleSendMessage(String message) {
        String from = extractValue(message, "from");
        String to = extractValue(message, "to");
        String msg = extractValue(message, "message");
        String isGroupStr = extractValue(message, "isGroup");
        boolean isGroup = Boolean.parseBoolean(isGroupStr);

        if (from != null && to != null && msg != null) {
            String timestamp = new Date().toString();
            String messageJson = "{\"from\":\"" + from + "\",\"to\":\"" + to + "\",\"message\":\"" + 
                                msg + "\",\"timestamp\":\"" + timestamp + "\",\"isGroup\":" + isGroup + "}";
            
            String historyKey = isGroup ? to : from + "_" + to;
            ChatServer.getHistorial().computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);

            if (isGroup) {
                ChatServer.broadcastToAll("{\"action\":\"MESSAGE\",\"message\":" + messageJson + "}");
            } else {
                ChatServer.sendToUser(to, "{\"action\":\"MESSAGE\",\"message\":" + messageJson + "}");
                enviarRespuesta("{\"action\":\"MESSAGE\",\"message\":" + messageJson + "}");
            }
        }
    }

    private void handleGetHistory(String message) {
        String target = extractValue(message, "target");
        String fromUser = extractValue(message, "from");
        boolean isGroup = Boolean.parseBoolean(extractValue(message, "isGroup"));
        
        if (target != null && fromUser != null) {
            String historyKey = isGroup ? target : fromUser + "_" + target;
            List<String> history = ChatServer.getHistorial().getOrDefault(historyKey, new ArrayList<>());
            enviarRespuesta("{\"action\":\"HISTORY\",\"messages\":" + history + "}");
        }
    }

    private void handleGetUsers() {
        List<String> users = new ArrayList<>(ChatServer.getUsuarios().values());
        enviarRespuesta("{\"action\":\"USER_LIST\",\"users\":" + users + "}");
    }

    private void handleGetGroups() {
        List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
        enviarRespuesta("{\"action\":\"GROUP_LIST\",\"groups\":" + groups + "}");
    }

    private void broadcastUserList() {
        List<String> users = new ArrayList<>(ChatServer.getUsuarios().values());
        String userListJson = "{\"action\":\"USER_LIST\",\"users\":" + users + "}";
        ChatServer.broadcastToAll(userListJson);
    }

    private void broadcastGroupList() {
        List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
        String groupListJson = "{\"action\":\"GROUP_LIST\",\"groups\":" + groups + "}";
        ChatServer.broadcastToAll(groupListJson);
    }

    public void enviarRespuesta(String respuesta) {
        if (out != null) {
            out.println(respuesta);
            out.flush();
        }
    }

    private String extractValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":\"";
            int start = json.indexOf(searchKey);
            if (start == -1) {
                searchKey = "\"" + key + "\":";
                start = json.indexOf(searchKey);
                if (start == -1) return null;
                
                start += searchKey.length();
                int end = json.indexOf(",", start);
                if (end == -1) end = json.indexOf("}", start);
                if (end == -1) return null;
                
                return json.substring(start, end).trim();
            }
            
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
            ChatServer.getUsuarios().remove(clientId);
            ChatServer.getSemaphore().release();
            
            if (in != null) in.close();
            if (out != null) out.close();
            if (socket != null && !socket.isClosed()) socket.close();
            
            System.out.println("Cliente desconectado: " + clientId);
            broadcastUserList();
        } catch (IOException e) {
            System.err.println("Error al cerrar conexión: " + e.getMessage());
        }
    }
}