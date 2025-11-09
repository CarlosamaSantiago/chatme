package com.chat.servidor;

import java.nio.file.*;
import java.util.*;

public class HistoryManager {
    
    private static final String DATA_DIR = "data";
    private static final String HISTORY_FILE = "history.json";
    
    public static void saveHistory(Map<String, List<String>> historial, Map<String, List<String>> grupos) {
        try {

            Path dataPath = Paths.get(DATA_DIR);
            if (!Files.exists(dataPath)) {
                Files.createDirectories(dataPath);
            }
            
            Map<String, Object> data = new HashMap<>();
            data.put("historial", historial);
            data.put("grupos", grupos);
            
            String json = toJson(data);
            
            Path filePath = dataPath.resolve(HISTORY_FILE);
            Files.write(filePath, json.getBytes("UTF-8"));
            
            System.out.println("Historial guardado en: " + filePath.toAbsolutePath());
            
        } catch (Exception e) {
            System.err.println("Error al guardar historial: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public static void loadHistory(Map<String, List<String>> historial, Map<String, List<String>> grupos) {
        try {
            Path filePath = Paths.get(DATA_DIR, HISTORY_FILE);
            
            if (!Files.exists(filePath)) {
                System.out.println("No se encontró archivo de historial. Iniciando con historial vacío.");
                return;
            }
            
            byte[] bytes = Files.readAllBytes(filePath);
            String json = new String(bytes, "UTF-8");
            
            Map<String, Object> data = fromJson(json);
            
            if (data.containsKey("historial")) {
                Object historialObj = data.get("historial");
                if (historialObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, List<String>> loadedHistorial = (Map<String, List<String>>) historialObj;
                    if (loadedHistorial != null) {
                        historial.putAll(loadedHistorial);
                        System.out.println("Historial cargado: " + loadedHistorial.size() + " conversaciones");
                    }
                }
            }
            
            if (data.containsKey("grupos")) {
                Object gruposObj = data.get("grupos");
                if (gruposObj instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, List<String>> loadedGrupos = (Map<String, List<String>>) gruposObj;
                    if (loadedGrupos != null) {
                        grupos.putAll(loadedGrupos);
                        System.out.println("Grupos cargados: " + loadedGrupos.size() + " grupos");
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error al cargar historial: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static String toJson(Map<String, Object> data) {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        
        boolean first = true;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (!first) json.append(",\n");
            first = false;
            
            json.append("  \"").append(escapeJson(entry.getKey())).append("\": ");
            
            Object value = entry.getValue();
            if (value instanceof Map) {
                json.append(mapToJson((Map<?, ?>) value));
            } else if (value instanceof List) {
                json.append(listToJson((List<?>) value));
            } else {
                json.append("\"").append(escapeJson(value.toString())).append("\"");
            }
        }
        
        json.append("\n}");
        return json.toString();
    }
    
    private static String mapToJson(Map<?, ?> map) {
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!first) json.append(",\n");
            first = false;
            
            json.append("    \"").append(escapeJson(entry.getKey().toString())).append("\": ");
            
            Object value = entry.getValue();
            if (value instanceof List) {
                json.append(listToJson((List<?>) value));
            } else if (value instanceof Map) {
                json.append(mapToJson((Map<?, ?>) value));
            } else {
                json.append("\"").append(escapeJson(value.toString())).append("\"");
            }
        }
        
        json.append("\n  }");
        return json.toString();
    }
    
    private static String listToJson(List<?> list) {
        StringBuilder json = new StringBuilder();
        json.append("[\n");
        
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) json.append(",\n");
            
            Object item = list.get(i);
            if (item instanceof String) {

                String str = (String) item;
                if (str.trim().startsWith("{")) {
                    json.append("      ").append(str);
                } else {
                    json.append("      \"").append(escapeJson(str)).append("\"");
                }
            } else if (item instanceof List) {
                json.append("      ").append(listToJson((List<?>) item));
            } else if (item instanceof Map) {
                json.append("      ").append(mapToJson((Map<?, ?>) item));
            } else {
                json.append("      \"").append(escapeJson(item.toString())).append("\"");
            }
        }
        
        json.append("\n    ]");
        return json.toString();
    }
    
    private static Map<String, Object> fromJson(String json) {
        Map<String, Object> result = new HashMap<>();
        
        try {

            json = json.trim();
            if (!json.startsWith("{") || !json.endsWith("}")) {
                throw new IllegalArgumentException("JSON inválido");
            }
            
            int historialStart = json.indexOf("\"historial\"");
            int gruposStart = json.indexOf("\"grupos\"");
            
            if (historialStart != -1) {
                String historialJson = extractObject(json, historialStart);
                result.put("historial", parseMap(historialJson));
            }
            
            if (gruposStart != -1) {
                String gruposJson = extractObject(json, gruposStart);
                result.put("grupos", parseMap(gruposJson));
            }
            
        } catch (Exception e) {
            System.err.println("Error al parsear JSON: " + e.getMessage());

        }
        
        return result;
    }
    
    private static String extractObject(String json, int start) {
        int colonPos = json.indexOf(':', start);
        if (colonPos == -1) return "";
        
        int objStart = colonPos + 1;
        while (objStart < json.length() && Character.isWhitespace(json.charAt(objStart))) {
            objStart++;
        }
        
        if (objStart >= json.length()) return "";
        
        char firstChar = json.charAt(objStart);
        if (firstChar == '{') {

            int depth = 0;
            int i = objStart;
            while (i < json.length()) {
                char c = json.charAt(i);
                if (c == '{') depth++;
                if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        return json.substring(objStart, i + 1);
                    }
                }
                i++;
            }
        } else if (firstChar == '[') {

            int depth = 0;
            int i = objStart;
            while (i < json.length()) {
                char c = json.charAt(i);
                if (c == '[') depth++;
                if (c == ']') {
                    depth--;
                    if (depth == 0) {
                        return json.substring(objStart, i + 1);
                    }
                }
                i++;
            }
        }
        
        return "";
    }
    

    private static Map<String, List<String>> parseMap(String json) {
        Map<String, List<String>> result = new HashMap<>();
        
        if (json == null || json.trim().isEmpty() || !json.startsWith("{")) {
            return result;
        }
        

        json = json.trim();
        if (json.length() < 2) return result;
        

        String content = json.substring(1, json.length() - 1).trim();
        

        List<String> entries = splitJsonEntries(content);
        
        for (String entry : entries) {
            int colonPos = entry.indexOf(':');
            if (colonPos == -1) continue;
            
            String key = entry.substring(0, colonPos).trim();
            String value = entry.substring(colonPos + 1).trim();
            

            key = key.replaceAll("^\"|\"$", "");
            

            List<String> list = parseList(value);
            result.put(key, list);
        }
        
        return result;
    }
    
    private static List<String> splitJsonEntries(String content) {
        List<String> entries = new ArrayList<>();
        if (content.trim().isEmpty()) return entries;
        
        int start = 0;
        int depth = 0;
        boolean inString = false;
        
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            
            if (c == '"' && (i == 0 || content.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (c == '{' || c == '[') {
                    depth++;
                } else if (c == '}' || c == ']') {
                    depth--;
                } else if (c == ',' && depth == 0) {
                    entries.add(content.substring(start, i).trim());
                    start = i + 1;
                }
            }
        }
        

        if (start < content.length()) {
            entries.add(content.substring(start).trim());
        }
        
        return entries;
    }
    

    private static List<String> parseList(String json) {
        List<String> result = new ArrayList<>();
        
        if (json == null || json.trim().isEmpty() || !json.startsWith("[")) {
            return result;
        }
        
        json = json.trim();
        if (json.length() < 2) return result;
        

        String content = json.substring(1, json.length() - 1).trim();
        if (content.isEmpty()) return result;
        

        List<String> items = splitJsonItems(content);
        
        for (String item : items) {
            item = item.trim();

            if (item.startsWith("\"") && item.endsWith("\"")) {
                item = item.substring(1, item.length() - 1);
                item = unescapeJson(item);
            }
            result.add(item);
        }
        
        return result;
    }
    

    private static List<String> splitJsonItems(String content) {
        List<String> items = new ArrayList<>();
        if (content.trim().isEmpty()) return items;
        
        int start = 0;
        int depth = 0;
        boolean inString = false;
        
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            
            if (c == '"' && (i == 0 || content.charAt(i - 1) != '\\')) {
                inString = !inString;
            } else if (!inString) {
                if (c == '{' || c == '[') {
                    depth++;
                } else if (c == '}' || c == ']') {
                    depth--;
                } else if (c == ',' && depth == 0) {
                    items.add(content.substring(start, i).trim());
                    start = i + 1;
                }
            }
        }
        

        if (start < content.length()) {
            items.add(content.substring(start).trim());
        }
        
        return items;
    }
    

    private static String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
    

    private static String unescapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\\"", "\"")
                  .replace("\\\\", "\\")
                  .replace("\\n", "\n")
                  .replace("\\r", "\r")
                  .replace("\\t", "\t");
    }
}

