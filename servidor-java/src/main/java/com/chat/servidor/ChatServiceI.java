package com.chat.servidor;

import Chat.*;
import com.zeroc.Ice.Current;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ChatServiceI implements ChatService {

    // Mapa para clientes Ice conectados
    private static Map<String, ChatServiceI> clientesIce = new ConcurrentHashMap<>();
    private String username;

    @Override
    public void register(String username, Current current) throws ChatException {
        this.username = username;
        clientesIce.put(username, this);
        
        // Registrar en el sistema existente
        ChatServer.getUsuarios().put("ice:" + username, username);
        System.out.println("✅ Usuario registrado via Ice: " + username);
        
        broadcastUserList();
    }

    @Override
    public void createGroup(String groupName, Current current) throws ChatException {
        if (groupName == null || groupName.trim().isEmpty()) {
            throw new ChatException("Nombre de grupo inválido");
        }
        
        synchronized (ChatServer.getGrupos()) {
            if (!ChatServer.getGrupos().containsKey(groupName)) {
                ChatServer.getGrupos().put(groupName, new ArrayList<>());
                ChatServer.getHistorial().put(groupName, new ArrayList<>());
                System.out.println("✅ Grupo creado via Ice: " + groupName);
                broadcastGroupList();
            } else {
                throw new ChatException("El grupo ya existe");
            }
        }
    }

    @Override
    public void sendMessage(String from, String to, String message, boolean isGroup, Current current) 
            throws ChatException {
        
        if (from == null || to == null || message == null) {
            throw new ChatException("Datos incompletos para enviar mensaje");
        }

        // REUTILIZAR TU LÓGICA ACTUAL de handleSendMessage
        String timestamp = new Date().toString();
        String messageJson = buildMessageJson(from, to, message, timestamp, isGroup);

        // Guardar en historial (misma lógica que tu ClientHandler)
        String historyKey = getHistoryKey(from, to, isGroup);
        ChatServer.getHistorial()
            .computeIfAbsent(historyKey, k -> new ArrayList<>())
            .add(messageJson);

        System.out.println("📨 Mensaje Ice de " + from + " a " + to + ": " + message);

        // Broadcast a todos los clientes (sockets + ice)
        String broadcastMsg = "{\"action\":\"MESSAGE\",\"message\":" + messageJson + "}";
        ChatServer.broadcastToAll(broadcastMsg);
        broadcastToIceClients(broadcastMsg);
    }

    @Override
    public StringList getUsers(Current current) {
        StringList list = new StringList();
        list.addAll(new ArrayList<>(ChatServer.getUsuarios().values()));
        return list;
    }

    @Override
    public StringList getGroups(Current current) {
        StringList list = new StringList();
        list.addAll(new ArrayList<>(ChatServer.getGrupos().keySet()));
        return list;
    }

    @Override
    public MessageList getHistory(String target, String fromUser, boolean isGroup, Current current) {
        String historyKey = getHistoryKey(fromUser, target, isGroup);
        List<String> historyJson = ChatServer.getHistorial().getOrDefault(historyKey, new ArrayList<>());
        
        MessageList messageList = new MessageList();
        for (String json : historyJson) {
            messageList.add(parseJsonToMessage(json));
        }
        return messageList;
    }

    // ===== MÉTODOS AUXILIARES =====
    
    private String buildMessageJson(String from, String to, String message, String timestamp, boolean isGroup) {
        return String.format(
            "{\"from\":\"%s\",\"to\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\",\"isGroup\":%s}",
            escapeJson(from), escapeJson(to), escapeJson(message), timestamp, isGroup
        );
    }

    private String getHistoryKey(String from, String to, boolean isGroup) {
        if (isGroup) {
            return to;
        } else {
            List<String> pair = Arrays.asList(from, to);
            Collections.sort(pair);
            return pair.get(0) + "_" + pair.get(1);
        }
    }

    private Chat.Message parseJsonToMessage(String json) {
        try {
            // Extraer valores del JSON (similar a tu extractValue)
            String from = extractValue(json, "from");
            String to = extractValue(json, "to");
            String message = extractValue(json, "message");
            String timestamp = extractValue(json, "timestamp");
            boolean isGroup = Boolean.parseBoolean(extractValue(json, "isGroup"));
            
            return new Chat.Message(from, to, message, timestamp, isGroup);
        } catch (Exception e) {
            return new Chat.Message("", "", "", "", false);
        }
    }

    private String extractValue(String json, String key) {
        String searchKey = "\"" + key + "\":";
        int start = json.indexOf(searchKey);
        if (start == -1) return "";
        
        start += searchKey.length();
        if (json.charAt(start) == '\"') {
            start++;
            int end = json.indexOf("\"", start);
            return end != -1 ? json.substring(start, end) : "";
        } else {
            int end = json.indexOf(",", start);
            if (end == -1) end = json.indexOf("}", start);
            return end != -1 ? json.substring(start, end).trim() : "";
        }
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private void broadcastUserList() {
        List<String> users = new ArrayList<>(ChatServer.getUsuarios().values());
        String json = buildUserListJson(users);
        ChatServer.broadcastToAll(json);
        broadcastToIceClients(json);
    }

    private void broadcastGroupList() {
        List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
        String json = buildGroupListJson(groups);
        ChatServer.broadcastToAll(json);
        broadcastToIceClients(json);
    }

    private void broadcastToIceClients(String message) {
        for (ChatServiceI client : clientesIce.values()) {
            // Aquí implementarías el callback para clientes Ice
            // Por ahora solo log
            System.out.println("Broadcasting to Ice client: " + message);
        }
    }

    private String buildUserListJson(List<String> users) {
        StringBuilder json = new StringBuilder("{\"action\":\"USER_LIST\",\"users\":[");
        for (int i = 0; i < users.size(); i++) {
            json.append("\"").append(escapeJson(users.get(i))).append("\"");
            if (i < users.size() - 1) json.append(",");
        }
        json.append("]}");
        return json.toString();
    }

    private String buildGroupListJson(List<String> groups) {
        StringBuilder json = new StringBuilder("{\"action\":\"GROUP_LIST\",\"groups\":[");
        for (int i = 0; i < groups.size(); i++) {
            json.append("\"").append(escapeJson(groups.get(i))).append("\"");
            if (i < groups.size() - 1) json.append(",");
        }
        json.append("]}");
        return json.toString();
    }
}