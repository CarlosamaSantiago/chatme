package com.chat.servidor;

import com.zeroc.Ice.*;
import com.zeroc.Ice.Object;
import java.lang.Exception;

// Imports de las clases generadas por slice2java desde Chat.ice
import Chat.*;

import java.util.*;
import java.util.concurrent.*;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.net.*;
import java.io.*;

public class IceChatServer {
    
    private static Map<String, MessageCallbackPrx> callbacks = new ConcurrentHashMap<>();
    private static Map<String, String> usernameToProxy = new ConcurrentHashMap<>();
    
    public static void main(String[] args) {
        // Cargar historial y grupos guardados
        HistoryManager.loadHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
        
        int status = 0;
        Communicator communicator = null;
        
        try {
            // Inicializar Ice
            communicator = Util.initialize(args);
            
            // Obtener configuración de variables de entorno
            String iceHost = System.getenv("ICE_HOST");
            if (iceHost == null || iceHost.isEmpty()) {
                iceHost = "0.0.0.0"; // Por defecto escuchar en todas las interfaces
            }
            
            // Puerto asignado por Render
            String portStr = System.getenv("PORT");
            int port = 10000; // Puerto por defecto
            if (portStr != null && !portStr.isEmpty()) {
                try {
                    port = Integer.parseInt(portStr);
                } catch (NumberFormatException e) {
                    System.err.println("⚠️  PORT inválido, usando puerto por defecto 10000");
                }
            }
            
            // Crear adaptador de objetos Ice con endpoint WebSocket en el puerto de Render
            String endpoint = "ws -h " + iceHost + " -p " + port;
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter", 
                endpoint
            );
            
            // Crear y activar el servidor
            ChatServiceI chatService = new ChatServiceI();
            ObjectPrx proxy = adapter.add(chatService, Util.stringToIdentity("ChatService"));
            adapter.activate();
            
            System.out.println("===========================================");
            System.out.println("Servidor Ice de Chat iniciado");
            System.out.println("WebSocket endpoint: ws://" + iceHost + ":" + port);
            System.out.println("===========================================");
            
            // Iniciar servidor HTTP simple para que Render detecte el servicio
            startHttpServer(port);
            
            // Esperar hasta que se cierre
            communicator.waitForShutdown();
            
        } catch (java.lang.Exception e) {
            System.err.println("Error en el servidor Ice: " + e.getMessage());
            e.printStackTrace();
            status = 1;
        } finally {
            if (communicator != null) {
                try {
                    communicator.destroy();
                } catch (java.lang.Exception e) {
                    System.err.println("Error al destruir communicator: " + e.getMessage());
                    status = 1;
                }
            }
            // Guardar historial antes de cerrar
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
        }
        
        System.exit(status);
    }
    
    // Servidor HTTP simple para health check de Render
    private static void startHttpServer(int port) {
        new Thread(() -> {
            try {
                ServerSocket httpServer = new ServerSocket(port);
                System.out.println("✅ Servidor HTTP iniciado en puerto " + port + " (para Render health check)");
                
                while (true) {
                    Socket client = httpServer.accept();
                    new Thread(() -> {
                        try {
                            BufferedReader in = new BufferedReader(new InputStreamReader(client.getInputStream()));
                            PrintWriter out = new PrintWriter(client.getOutputStream(), true);
                            
                            // Leer request
                            String line = in.readLine();
                            
                            // Responder con HTTP 200 OK
                            out.println("HTTP/1.1 200 OK");
                            out.println("Content-Type: text/plain");
                            out.println("Connection: close");
                            out.println();
                            out.println("ChatMe Ice Server - Running");
                            
                            client.close();
                        } catch (IOException e) {
                            // Ignorar errores de cliente individual
                        }
                    }).start();
                }
            } catch (IOException e) {
                System.err.println("⚠️  No se pudo iniciar servidor HTTP en puerto " + port + ": " + e.getMessage());
                System.err.println("⚠️  El servidor Ice seguirá funcionando, pero Render puede no detectarlo");
            }
        }).start();
    }
    
    // Implementación del servicio de chat
    static class ChatServiceI implements ChatService {
        
        @Override
        public synchronized void registerUser(String username, Current current) throws ChatException {
            if (username == null || username.trim().isEmpty()) {
                throw new ChatException("Nombre de usuario inválido");
            }
            
            ChatServer.getUsuariosRegistrados().add(username);
            System.out.println("Usuario registrado: " + username);
        }
        
        @Override
        public synchronized void createGroup(String groupName, Current current) throws ChatException {
            if (groupName == null || groupName.trim().isEmpty()) {
                throw new ChatException("Nombre de grupo inválido");
            }
            
            if (ChatServer.getGrupos().containsKey(groupName)) {
                throw new ChatException("El grupo ya existe");
            }
            
            ChatServer.getGrupos().put(groupName, new ArrayList<>());
            ChatServer.getHistorial().put(groupName, new ArrayList<>());
            System.out.println("Grupo creado: " + groupName);
            
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
        }
        
        @Override
        public synchronized void sendMessage(String from, String to, String content, boolean isGroup, Current current) 
                throws ChatException {
            if (from == null || to == null || content == null) {
                throw new ChatException("Datos incompletos para enviar mensaje");
            }
            
            long timestamp = System.currentTimeMillis();
            String historyKey;
            
            if (isGroup) {
                historyKey = to;
            } else {
                List<String> pair = Arrays.asList(from, to);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }
            
            // Crear mensaje
            Message msg = new Message(from, to, content, timestamp, isGroup, "text", new byte[0]);
            
            // Guardar en historial
            String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                    escapeJson(to) + "\",\"message\":\"" + escapeJson(content) +
                    "\",\"timestamp\":\"" + timestamp + "\",\"isGroup\":" + isGroup + "}";
            
            ChatServer.getHistorial().computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
            
            System.out.println("Mensaje de " + from + " a " + to + ": " + content);
            
            // Notificar en tiempo real
            notifyMessage(msg, to, isGroup);
        }
        
        @Override
        public synchronized void sendAudio(String from, String to, byte[] data, boolean isGroup, Current current) 
                throws ChatException {
            if (from == null || to == null || data == null) {
                throw new ChatException("Datos incompletos para enviar audio");
            }
            
            long timestamp = System.currentTimeMillis();
            String historyKey;
            
            if (isGroup) {
                historyKey = to;
            } else {
                List<String> pair = Arrays.asList(from, to);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }
            
            // Crear mensaje de audio
            Message msg = new Message(from, to, "[Nota de voz]", timestamp, isGroup, "audio", data);
            
            // Guardar en historial (convertir audio a base64 para JSON)
            String audioBase64 = Base64.getEncoder().encodeToString(data);
            String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                    escapeJson(to) + "\",\"message\":\"[Nota de voz]\",\"timestamp\":\"" + 
                    timestamp + "\",\"isGroup\":" + isGroup + ",\"type\":\"audio\",\"audioData\":\"" + 
                    audioBase64 + "\"}";
            
            ChatServer.getHistorial().computeIfAbsent(historyKey, k -> new ArrayList<>()).add(messageJson);
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
            
            System.out.println("Nota de voz de " + from + " a " + to);
            
            // Notificar en tiempo real
            notifyMessage(msg, to, isGroup);
        }
        
        @Override
        public synchronized void startCall(String from, String to, boolean isGroup, Current current) 
                throws ChatException {
            if (from == null || to == null) {
                throw new ChatException("Datos incompletos para iniciar llamada");
            }
            
            long timestamp = System.currentTimeMillis();
            Message msg = new Message(from, to, "[Llamada iniciada]", timestamp, isGroup, "call", new byte[0]);
            
            System.out.println("Llamada iniciada de " + from + " a " + to);
            
            // Notificar en tiempo real
            notifyMessage(msg, to, isGroup);
        }
        
        @Override
        public synchronized Message[] getHistory(String target, String fromUser, boolean isGroup, Current current) 
                throws ChatException {
            if (target == null) {
                return new Message[0];
            }
            
            String historyKey;
            if (isGroup) {
                historyKey = target;
            } else {
                List<String> pair = Arrays.asList(fromUser, target);
                Collections.sort(pair);
                historyKey = pair.get(0) + "_" + pair.get(1);
            }
            
            List<String> history = ChatServer.getHistorial().getOrDefault(historyKey, new ArrayList<>());
            List<Message> messages = new ArrayList<>();
            
            for (String msgJson : history) {
                messages.add(parseMessageFromJson(msgJson));
            }
            
            // MessageSeq se traduce a Message[] en Java
            return messages.toArray(new Message[0]);
        }
        
        @Override
        public synchronized String[] getUsers(Current current) throws ChatException {
            List<String> users = new ArrayList<>(ChatServer.getUsuariosRegistrados());
            Collections.sort(users);
            return users.toArray(new String[0]);
        }
        
        @Override
        public synchronized String[] getGroups(Current current) throws ChatException {
            List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
            return groups.toArray(new String[0]);
        }
        
        @Override
        public synchronized void subscribe(MessageCallbackPrx callback, String username, Current current) 
                throws ChatException {
            if (callback == null || username == null) {
                throw new ChatException("Datos inválidos para suscripción");
            }
            
            callbacks.put(username, callback);
            usernameToProxy.put(username, callback.toString());
            System.out.println("Usuario suscrito: " + username);
        }
        
        @Override
        public synchronized void unsubscribe(String username, Current current) throws ChatException {
            if (username != null) {
                callbacks.remove(username);
                usernameToProxy.remove(username);
                System.out.println("Usuario desuscrito: " + username);
            }
        }
        
        private void notifyMessage(Message msg, String target, boolean isGroup) {
            if (isGroup) {
                // Notificar a todos los suscriptores usando onGroupMessage
                for (Map.Entry<String, MessageCallbackPrx> entry : callbacks.entrySet()) {
                    try {
                        entry.getValue().onGroupMessage(msg, target);
                        System.out.println("✅ Notificación enviada a " + entry.getKey() + " (grupo)");
                    } catch (com.zeroc.Ice.ConnectionLostException e) {
                        System.err.println("⚠️  Conexión perdida con " + entry.getKey() + " (grupo), removiendo callback");
                        callbacks.remove(entry.getKey());
                        usernameToProxy.remove(entry.getKey());
                    } catch (java.lang.Exception e) {
                        System.err.println("❌ Error notificando a " + entry.getKey() + " (grupo): " + 
                            (e.getMessage() != null ? e.getMessage() : e.getClass().getName()));
                        if (e.getCause() != null) {
                            System.err.println("   Causa: " + e.getCause().getMessage());
                        }
                        e.printStackTrace();
                    }
                }
            } else {
                // Notificar solo al destinatario
                MessageCallbackPrx targetCallback = callbacks.get(target);
                if (targetCallback != null) {
                    try {
                        targetCallback.onMessage(msg);
                        System.out.println("✅ Notificación enviada a destinatario: " + target);
                    } catch (com.zeroc.Ice.ConnectionLostException e) {
                        System.err.println("⚠️  Conexión perdida con destinatario " + target + ", removiendo callback");
                        callbacks.remove(target);
                        usernameToProxy.remove(target);
                    } catch (java.lang.Exception e) {
                        System.err.println("❌ Error notificando a destinatario " + target + ": " + 
                            (e.getMessage() != null ? e.getMessage() : e.getClass().getName()));
                        if (e.getCause() != null) {
                            System.err.println("   Causa: " + e.getCause().getMessage());
                        }
                        e.printStackTrace();
                    }
                } else {
                    System.out.println("⚠️  No hay callback registrado para destinatario: " + target);
                }
                // También notificar al remitente
                MessageCallbackPrx senderCallback = callbacks.get(msg.from);
                if (senderCallback != null) {
                    try {
                        senderCallback.onMessage(msg);
                        System.out.println("✅ Notificación enviada a remitente: " + msg.from);
                    } catch (com.zeroc.Ice.ConnectionLostException e) {
                        System.err.println("⚠️  Conexión perdida con remitente " + msg.from + ", removiendo callback");
                        callbacks.remove(msg.from);
                        usernameToProxy.remove(msg.from);
                    } catch (java.lang.Exception e) {
                        System.err.println("❌ Error notificando a remitente " + msg.from + ": " + 
                            (e.getMessage() != null ? e.getMessage() : e.getClass().getName()));
                        if (e.getCause() != null) {
                            System.err.println("   Causa: " + e.getCause().getMessage());
                        }
                        e.printStackTrace();
                    }
                } else {
                    System.out.println("⚠️  No hay callback registrado para remitente: " + msg.from);
                }
            }
        }
        
        private Message parseMessageFromJson(String json) {
            try {
                String from = extractValue(json, "from");
                String to = extractValue(json, "to");
                String content = extractValue(json, "message");
                String timestampStr = extractValue(json, "timestamp");
                long timestamp = timestampStr != null ? Long.parseLong(timestampStr) : System.currentTimeMillis();
                String isGroupStr = extractValue(json, "isGroup");
                boolean isGroup = "true".equals(isGroupStr);
                String type = extractValue(json, "type");
                if (type == null) type = "text";
                
                byte[] audioData = new byte[0];
                if ("audio".equals(type)) {
                    String audioBase64 = extractValue(json, "audioData");
                    if (audioBase64 != null) {
                        audioData = Base64.getDecoder().decode(audioBase64);
                    }
                }
                
                return new Message(from, to, content, timestamp, isGroup, type, audioData);
            } catch (java.lang.Exception e) {
                System.err.println("Error parseando mensaje: " + e.getMessage());
                return new Message("", "", "", System.currentTimeMillis(), false, "text", new byte[0]);
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
                    return json.substring(start, end).trim().replace("\"", "");
                }
                start += searchKey.length();
                int end = json.indexOf("\"", start);
                if (end == -1) return null;
                return json.substring(start, end);
            } catch (java.lang.Exception e) {
                return null;
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
}
