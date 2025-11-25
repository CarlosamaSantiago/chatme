package com.chat.servidor.services;

import java.util.*;

import com.chat.servidor.ChatServer;
import com.chat.servidor.HistoryManager;

public class ServicesImpl {
    
    public ServicesImpl() {
        // Constructor vacío, usa los métodos estáticos de ChatServer
    }

    public void registerUser(String username) {
        ChatServer.getUsuariosRegistrados().add(username);
        System.out.println("Usuario registrado: " + username);
    }

    public List<String> getUsers() {
        List<String> users = new ArrayList<>(ChatServer.getUsuariosRegistrados());
        Collections.sort(users);
        return users;
    }

    public List<String> getGroups() {
        List<String> groups = new ArrayList<>(ChatServer.getGrupos().keySet());
        Collections.sort(groups);
        return groups;
    }

    public void createGroup(String groupName) {
        if (!ChatServer.getGrupos().containsKey(groupName)) {
            ChatServer.getGrupos().put(groupName, new ArrayList<>());
            ChatServer.getHistorial().put(groupName, new ArrayList<>());
            System.out.println("Grupo creado: " + groupName);
            HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
        } else {
            throw new RuntimeException("El grupo ya existe");
        }
    }

    public void sendMessage(String from, String to, String message, boolean isGroup) {
        String timestamp = new Date().toString();
        String messageJson = "{\"from\":\"" + escapeJson(from) + "\",\"to\":\"" +
                escapeJson(to) + "\",\"message\":\"" + escapeJson(message) +
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
        System.out.println("Mensaje de " + from + " a " + to + ": " + message);
        HistoryManager.saveHistory(ChatServer.getHistorial(), ChatServer.getGrupos());
    }

    public List<String> getHistory(String target, String from, boolean isGroup) {
        String historyKey;
        if (isGroup) {
            historyKey = target;
        } else {
            List<String> pair = Arrays.asList(from, target);
            Collections.sort(pair);
            historyKey = pair.get(0) + "_" + pair.get(1);
        }

        return ChatServer.getHistorial().getOrDefault(historyKey, new ArrayList<>());
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
}

