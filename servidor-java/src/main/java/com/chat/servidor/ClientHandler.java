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
            } else if (message.contains("\"action\":\"SEND_VOICE_NOTE\"")) {
                handleSendVoiceNote(message);
            } else if (message.contains("\"action\":\"START_CALL\"")) {
                handleStartCall(message);
            } else if (message.contains("\"action\":\"GET_HISTORY\"")) {
                handleGetHistory(message);
            } else if (message.contains("\"action\":\"REGISTER\"")) {
                handleRegister(message);
            } else if (message.contains("\"action\":\"GET_USERS\"")) {
                handleGetUsers();
            } else if (message.contains("\"action\":\"GET_GROUPS\"")
                    || message.contains("\"action\":\"LIST_GROUPS\"")) {
                handleGetGroups();
            } else {
                enviarRespuesta("{\"error\":\"Acción no reconocida\"}");
            }

        } catch (Exception e) {
            enviarRespuesta("{\"error\":\"" + e.getMessage().replace("\"", "\\\"") + "\"}");
        }
    }

    private void handleRegister(String message) {
        this.username = extractValue(message, "username");

        if (username != null && !username.trim().isEmpty()) {

            ChatServer.getUsuariosRegistrados().add(username);
            ChatServer.getUsuarios().put(clientId, username);
            ChatServer.getClientesConectados().put(clientId, this);
            ChatServer.getUsuariosConectados().put(username, this);

            System.out.println("Usuario registrado: " + username + " [" + clientId + "]");

            enviarRespuesta("{\"action\":\"REGISTERED\",\"username\":\"" + username + "\"}");

            broadcastUserList();
        }
    }

    private void handleCreateGroup(String message) {
        String groupName = extractValue(message, "groupName");
        if (groupName != null && !groupName.trim().isEmpty()) {
            if (!ChatServer.getGrupos().containsKey(groupName)) {
                ChatServer.getGrupos().put(groupName, new ArrayList<>());
                ChatServer.getHistorial().put(groupName, new ArrayList<>());
                System.out.println("Grupo creado: " + groupName);


                HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());

                enviarRespuesta("{\"action\":\"GROUP_CREATED\",\"groupName\":\"" + groupName + "\"}");
            } else {
                enviarRespuesta("{\"error\":\"El grupo ya existe\"}");
            }
        } else {
            enviarRespuesta("{\"error\":\"Nombre de grupo inválido\"}");
        }
    }

    private void handleSendMessage(String message) {
        String from = extractValue(message, "from");
        String to = extractValue(message, "to");
        String msg = extractValue(message, "message");
        String isGroupStr = extractValue(message, "isGroup");
        boolean isGroup = "true".equals(isGroupStr);

        if (from != null && to != null && msg != null) {
            String timestamp = new Date().toString();
            String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                    escapeJson(to) + "\",\"message\":\"" + escapeJson(msg) +
                    "\",\"timestamp\":\"" + timestamp + "\",\"isGroup\":" + isGroup + "}";


            String historyKey;
            if (isGroup) {
                historyKey = to;
            } else {

                List<String> pair = Arrays.asList(from, to);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }

            ChatServer.getHistorial().computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);

            System.out.println("Mensaje de " + from + " a " + to + ": " + msg);


            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());


            enviarRespuesta("{\"action\":\"MESSAGE_SENT\",\"message\":" + messageJson + "}");
        } else {
            enviarRespuesta("{\"error\":\"Datos incompletos para enviar mensaje\"}");
        }
    }

    private void handleGetHistory(String message) {
        String target = extractValue(message, "target");
        String fromUser = extractValue(message, "from");
        String isGroupStr = extractValue(message, "isGroup");
        boolean isGroup = "true".equals(isGroupStr);

        if (target != null) {
            String historyKey;
            if (isGroup) {
                historyKey = target;
            } else {
                List<String> pair = Arrays.asList(fromUser, target);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }

            List<String> history = ChatServer.getHistorial().getOrDefault(historyKey, new ArrayList<>());

            System.out.println("Historial solicitado para: " + historyKey + " (" + history.size() + " mensajes)");


            StringBuilder json = new StringBuilder("{\"action\":\"HISTORY\",\"messages\":[");
            for (int i = 0; i < history.size(); i++) {
                json.append(history.get(i));
                if (i < history.size() - 1)
                    json.append(",");
            }
            json.append("]}");

            enviarRespuesta(json.toString());
        } else {
            enviarRespuesta("{\"action\":\"HISTORY\",\"messages\":[]}");
        }
    }

    private void handleGetUsers() {

        List<String> users = new ArrayList<>(ChatServer.getUsuariosRegistrados());
        Collections.sort(users);
        StringBuilder json = new StringBuilder("{\"users\":[");
        for (int i = 0; i < users.size(); i++) {
            json.append("\"").append(escapeJson(users.get(i))).append("\"");
            if (i < users.size() - 1)
                json.append(",");
        }
        json.append("]}");

        enviarRespuesta(json.toString());
    }

    private void handleGetGroups() {
        List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
        StringBuilder json = new StringBuilder("{\"action\":\"GROUP_LIST\",\"groups\":[");
        for (int i = 0; i < groups.size(); i++) {
            json.append("\"").append(escapeJson(groups.get(i))).append("\"");
            if (i < groups.size() - 1)
                json.append(",");
        }
        json.append("]}");

        System.out.println("Enviando lista de grupos: " + groups);
        enviarRespuesta(json.toString());
    }

    private void handleSendVoiceNote(String message) {
        String from = extractValue(message, "from");
        String to = extractValue(message, "to");
        String isGroupStr = extractValue(message, "isGroup");
        boolean isGroup = "true".equals(isGroupStr);
        // Extraer audioData usando método especial para datos largos
        String audioDataStr = extractAudioData(message);

        if (from != null && to != null && audioDataStr != null && !audioDataStr.isEmpty()) {
            long timestamp = System.currentTimeMillis();
            String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                    escapeJson(to) + "\",\"message\":\"[Nota de voz]\",\"timestamp\":\"" + 
                    timestamp + "\",\"isGroup\":" + isGroup + ",\"type\":\"audio\",\"audioData\":\"" +
                    audioDataStr + "\"}";

            String historyKey;
            if (isGroup) {
                historyKey = to;
            } else {
                List<String> pair = Arrays.asList(from, to);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }

            ChatServer.getHistorial().computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());

            System.out.println("Nota de voz de " + from + " a " + to + " (size: " + audioDataStr.length() + " chars)");
            enviarRespuesta("{\"action\":\"VOICE_NOTE_SENT\",\"success\":true}");
        } else {
            enviarRespuesta("{\"error\":\"Datos incompletos para enviar nota de voz\"}");
        }
    }

    private String extractAudioData(String json) {
        try {
            String searchKey = "\"audioData\":\"";
            int start = json.indexOf(searchKey);
            if (start == -1) return null;
            
            start += searchKey.length();
            
            // Buscar el cierre de la cadena, manejando escapes
            int end = start;
            while (end < json.length()) {
                char c = json.charAt(end);
                if (c == '"' && json.charAt(end - 1) != '\\') {
                    break;
                }
                end++;
            }
            
            if (end >= json.length()) return null;
            
            return json.substring(start, end);
        } catch (Exception e) {
            System.err.println("Error extrayendo audioData: " + e.getMessage());
            return null;
        }
    }

    private void handleStartCall(String message) {
        String from = extractValue(message, "from");
        String to = extractValue(message, "to");
        String isGroupStr = extractValue(message, "isGroup");
        boolean isGroup = "true".equals(isGroupStr);

        if (from != null && to != null) {
            String timestamp = new Date().toString();
            String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                    escapeJson(to) + "\",\"message\":\"[Llamada iniciada]\",\"timestamp\":\"" + 
                    timestamp + "\",\"isGroup\":" + isGroup + ",\"type\":\"call\"}";

            System.out.println("Llamada iniciada de " + from + " a " + to);
            enviarRespuesta("{\"action\":\"CALL_STARTED\",\"message\":" + messageJson + "}");
        } else {
            enviarRespuesta("{\"error\":\"Datos incompletos para iniciar llamada\"}");
        }
    }

    private void broadcastUserList() {

    }

    private void broadcastGroupList() {

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
                if (start == -1)
                    return null;

                start += searchKey.length();
                int end = json.indexOf(",", start);
                if (end == -1)
                    end = json.indexOf("}", start);
                if (end == -1)
                    return null;

                return json.substring(start, end).trim().replace("\"", "");
            }

            start += searchKey.length();
            int end = json.indexOf("\"", start);
            if (end == -1)
                return null;

            return json.substring(start, end);
        } catch (Exception e) {
            return null;
        }
    }

    private String escapeJson(String str) {
        if (str == null)
            return "";
        return str.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private void cleanup() {
        try {
            ChatServer.getSemaphore().release();


            ChatServer.getClientesConectados().remove(clientId);
            

            if (username != null) {

                ClientHandler currentHandler = ChatServer.getUsuariosConectados().get(username);
                if (currentHandler == this) {
                    ChatServer.getUsuariosConectados().remove(username);
                }
            }

            if (in != null)
                in.close();
            if (out != null)
                out.close();
            if (socket != null && !socket.isClosed())
                socket.close();

        } catch (IOException e) {
            System.err.println("Error al cerrar conexión: " + e.getMessage());
        }
    }

}