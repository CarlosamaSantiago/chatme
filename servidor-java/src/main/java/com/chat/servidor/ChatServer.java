package com.chat.servidor;

import java.util.*;
import java.util.concurrent.*;

/**
 * Clase de utilidad para almacenar datos compartidos del chat.
 * Esta clase solo contiene métodos estáticos para acceder a los datos.
 * La comunicación real se realiza mediante ZeroC Ice RPC.
 */
public class ChatServer {

    // Almacenamiento de datos compartidos
    private static Map<String, List<String>> grupos = new ConcurrentHashMap<>();
    private static Map<String, List<String>> historial = new ConcurrentHashMap<>();
    private static Map<String, String> usuarios = new ConcurrentHashMap<>();
    // Usuarios registrados (independiente de conexiones activas)
    private static Set<String> usuariosRegistrados = ConcurrentHashMap.newKeySet();

    public static Map<String, List<String>> getGrupos() {
        return grupos;
    }

    public static Map<String, List<String>> getHistorial() {
        return historial;
    }

    public static Map<String, String> getUsuarios() {
        return usuarios;
    }

    public static Set<String> getUsuariosRegistrados() {
        return usuariosRegistrados;
    }

}