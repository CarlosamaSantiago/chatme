package com.chat.servidor.services;

import java.util.*;

import com.zeroc.Ice.Current;

import Chat.MessageDTO;
import Chat.ChatServices;
import Chat.StringArray;
import Chat.MessageArray;

public class ServiceIceImpl implements ChatServices {

    private ServicesImpl servicesImpl;
    private SubjectImpl subject;

    public ServiceIceImpl(ServicesImpl service, SubjectImpl sub) {
        servicesImpl = service;
        subject = sub;
    }

    @Override
    public void registerUser(String username, Current current) {
        servicesImpl.registerUser(username);
        subject.notifyNewUser(username);
    }

    @Override
    public StringArray getUsers(Current current) {
        List<String> users = servicesImpl.getUsers();
        StringArray result = new StringArray();
        result.addAll(users);
        return result;
    }

    @Override
    public StringArray getGroups(Current current) {
        List<String> groups = servicesImpl.getGroups();
        StringArray result = new StringArray();
        result.addAll(groups);
        return result;
    }

    @Override
    public void createGroup(String groupName, Current current) {
        servicesImpl.createGroup(groupName);
        subject.notifyNewGroup(groupName);
    }

    @Override
    public void sendMessage(String from, String to, String message, boolean isGroup, Current current) {
        servicesImpl.sendMessage(from, to, message, isGroup);
        
        // Crear MessageDTO para notificar
        MessageDTO msgDTO = new MessageDTO();
        msgDTO.from = from;
        msgDTO.to = to;
        msgDTO.message = message;
        msgDTO.timestamp = new Date().toString();
        msgDTO.isGroup = isGroup;
        
        subject.notifyNewMessage(msgDTO);
    }

    @Override
    public MessageArray getHistory(String target, String from, boolean isGroup, Current current) {
        List<String> historyJson = servicesImpl.getHistory(target, from, isGroup);
        MessageArray result = new MessageArray();
        
        for (String json : historyJson) {
            try {
                MessageDTO dto = parseMessageFromJson(json);
                result.add(dto);
            } catch (Exception e) {
                System.err.println("Error parseando mensaje: " + e.getMessage());
            }
        }
        
        return result;
    }

    private MessageDTO parseMessageFromJson(String json) {
        MessageDTO dto = new MessageDTO();
        
        // Parsear JSON simple
        dto.from = extractValue(json, "from");
        dto.to = extractValue(json, "to");
        dto.message = extractValue(json, "message");
        dto.timestamp = extractValue(json, "timestamp");
        
        String isGroupStr = extractValue(json, "isGroup");
        dto.isGroup = "true".equals(isGroupStr);
        
        return dto;
    }

    private String extractValue(String json, String key) {
        try {
            String searchKey = "\"" + key + "\":\"";
            int start = json.indexOf(searchKey);
            if (start == -1) {
                searchKey = "\"" + key + "\":";
                start = json.indexOf(searchKey);
                if (start == -1)
                    return "";
                start += searchKey.length();
                int end = json.indexOf(",", start);
                if (end == -1)
                    end = json.indexOf("}", start);
                if (end == -1)
                    return "";
                return json.substring(start, end).trim().replace("\"", "");
            }
            start += searchKey.length();
            int end = json.indexOf("\"", start);
            if (end == -1)
                return "";
            return json.substring(start, end);
        } catch (Exception e) {
            return "";
        }
    }
}

