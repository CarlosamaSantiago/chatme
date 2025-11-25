package com.chat.servidor;

import com.zeroc.Ice.*;
import java.util.*;
import java.util.concurrent.*;

public class ChatServer {

    public static void main(String[] args) {
        try (Communicator communicator = Util.initialize(args)) {
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints("ChatMaster", "ws -p 10000");
            
            ChatMasterI master = new ChatMasterI();
            adapter.add(master, Util.stringToIdentity("ChatMaster"));
            adapter.activate();
            
            System.out.println("✅ ChatMaster Ice iniciado en puerto 10000 (WebSocket)");
            communicator.waitForShutdown();
        } catch (Exception e) {
            System.err.println("❌ Error en servidor: " + e.getMessage());
            e.printStackTrace();
        }
    }
}

// Implementación del Master
class ChatMasterI implements Chat.ChatMaster {
    
    // Mapa de workers conectados
    private static Map<String, Chat.ChatWorkerPrx> workers = new ConcurrentHashMap<>();
    private static Map<String, String> userToWorker = new ConcurrentHashMap<>();
    
    // Estructuras de datos
    private static Map<String, List<String>> grupos = new ConcurrentHashMap<>();
    private static Map<String, List<String>> historial = new ConcurrentHashMap<>();
    private static Map<String, String> usuarios = new ConcurrentHashMap<>(); // workerId -> username

    @Override
    public void registerWorker(String workerId, Chat.ChatWorker workerPrx, Current current) {
        workers.put(workerId, workerPrx);
        System.out.println("✅ Worker registrado: " + workerId);
    }

    @Override
    public void unregisterWorker(String workerId, Current current) {
        workers.remove(workerId);
        // Remover usuario asociado si existe
        String username = usuarios.get(workerId);
        if (username != null) {
            userToWorker.remove(username);
            usuarios.remove(workerId);
            broadcastUserList();
        }
        System.out.println("❌ Worker desconectado: " + workerId);
    }

    @Override
    public void registerUser(String username, String workerId, Current current) throws Chat.ChatException {
        if (userToWorker.containsKey(username)) {
            throw new Chat.ChatException("Usuario ya existe: " + username);
        }
        
        // Si el worker ya tenía usuario, limpiar
        String oldUser = usuarios.get(workerId);
        if (oldUser != null) {
            userToWorker.remove(oldUser);
        }
        
        usuarios.put(workerId, username);
        userToWorker.put(username, workerId);
        System.out.println("✅ Usuario registrado: " + username + " en worker: " + workerId);
        
        broadcastUserList();
    }

    @Override
    public void createGroup(String groupName, String workerId, Current current) throws Chat.ChatException {
        if (grupos.containsKey(groupName)) {
            throw new Chat.ChatException("El grupo ya existe: " + groupName);
        }
        
        grupos.put(groupName, new ArrayList<>());
        historial.put(groupName, new ArrayList<>());
        System.out.println("✅ Grupo creado: " + groupName + " por worker: " + workerId);
        
        broadcastGroupList();
    }

    @Override
    public void sendMessage(Chat.Message msg, Current current) throws Chat.ChatException {
        // Validar que el remitente existe
        if (!userToWorker.containsKey(msg.from)) {
            throw new Chat.ChatException("Remitente no registrado: " + msg.from);
        }

        // Guardar en historial
        String historyKey = getHistoryKey(msg.from, msg.to, msg.isGroup);
        String messageJson = buildMessageJson(msg);
        historial.computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);

        System.out.println("📨 Mensaje de " + msg.from + " a " + msg.to + ": " + msg.message);

        // Entregar mensaje
        if (msg.isGroup) {
            // Broadcast a todos los workers
            broadcastToAllWorkers(msg);
        } else {
            // Enviar al destinatario
            deliverToUser(msg.to, msg);
            // También enviar al remitente para que vea su mensaje
            deliverToUser(msg.from, msg);
        }
    }

    @Override
    public Chat.StringList getUsers(Current current) {
        Chat.StringList list = new Chat.StringList();
        list.addAll(userToWorker.keySet());
        return list;
    }

    @Override
    public Chat.StringList getGroups(Current current) {
        Chat.StringList list = new Chat.StringList();
        list.addAll(grupos.keySet());
        return list;
    }

    @Override
    public Chat.MessageList getHistory(String target, String fromUser, boolean isGroup, Current current) {
        String historyKey = getHistoryKey(fromUser, target, isGroup);
        List<String> historyJson = historial.getOrDefault(historyKey, new ArrayList<>());
        
        Chat.MessageList messageList = new Chat.MessageList();
        for (String json : historyJson) {
            Chat.Message msg = parseJsonToMessage(json);
            if (msg != null) {
                messageList.add(msg);
            }
        }
        return messageList;
    }

    // ===== MÉTODOS DE BROADCAST =====
    
    private void broadcastUserList() {
        Chat.StringList users = getUsers(null);
        for (Chat.ChatWorkerPrx worker : workers.values()) {
            try {
                worker.updateUserList(users);
            } catch (Exception e) {
                System.err.println("Error broadcasting user list: " + e.getMessage());
            }
        }
    }

    private void broadcastGroupList() {
        Chat.StringList groups = getGroups(null);
        for (Chat.ChatWorkerPrx worker : workers.values()) {
            try {
                worker.updateGroupList(groups);
            } catch (Exception e) {
                System.err.println("Error broadcasting group list: " + e.getMessage());
            }
        }
    }

    private void broadcastToAllWorkers(Chat.Message msg) {
        for (Chat.ChatWorkerPrx worker : workers.values()) {
            try {
                worker.deliverMessage(msg);
            } catch (Exception e) {
                System.err.println("Error broadcasting message: " + e.getMessage());
            }
        }
    }

    private void deliverToUser(String username, Chat.Message msg) {
        String workerId = userToWorker.get(username);
        if (workerId != null) {
            Chat.ChatWorkerPrx worker = workers.get(workerId);
            if (worker != null) {
                try {
                    worker.deliverMessage(msg);
                } catch (Exception e) {
                    System.err.println("Error delivering to user " + username + ": " + e.getMessage());
                }
            }
        }
    }

    // ===== MÉTODOS AUXILIARES =====
    
    private String getHistoryKey(String from, String to, boolean isGroup) {
        if (isGroup) return to;
        List<String> pair = Arrays.asList(from, to);
        Collections.sort(pair);
        return pair.get(0) + "_" + pair.get(1);
    }

    private String buildMessageJson(Chat.Message msg) {
        return String.format("{\"from\":\"%s\",\"to\":\"%s\",\"message\":\"%s\",\"timestamp\":\"%s\",\"isGroup\":%s}",
            escapeJson(msg.from), escapeJson(msg.to), escapeJson(msg.message), msg.timestamp, msg.isGroup);
    }

    private Chat.Message parseJsonToMessage(String json) {
        try {
            String from = extractValue(json, "from");
            String to = extractValue(json, "to");
            String message = extractValue(json, "message");
            String timestamp = extractValue(json, "timestamp");
            boolean isGroup = Boolean.parseBoolean(extractValue(json, "isGroup"));
            return new Chat.Message(from, to, message, timestamp, isGroup);
        } catch (Exception e) {
            System.err.println("Error parsing JSON to Message: " + e.getMessage());
            return null;
        }
    }

    private String extractValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":\"";
            int start = json.indexOf(searchKey);
            if (start == -1) {
                searchKey = "\"" + key + "\":";
                start = json.indexOf(searchKey);
                if (start == -1) return "";

                start += searchKey.length();
                int end = json.indexOf(",", start);
                if (end == -1) end = json.indexOf("}", start);
                if (end == -1) return "";

                return json.substring(start, end).trim().replace("\"", "");
            }

            start += searchKey.length();
            int end = json.indexOf("\"", start);
            if (end == -1) return "";

            return json.substring(start, end);
        } catch (Exception e) {
            return "";
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
}