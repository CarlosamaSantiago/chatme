package com.chat.servidor;

import com.zeroc.Ice.*;
import java.util.*;
import java.util.concurrent.*;
import java.lang.Exception;

public class ChatServer {

    private static final int SOCKET_PORT = 5000;
    private static final int ICE_PORT = 10000;
    
    // TUS MAPAS EXISTENTES (NO CAMBIAN)
    private static Map<String, ClientHandler> clientesConectados = new ConcurrentHashMap<>();
    private static Map<String, List<String>> grupos = new ConcurrentHashMap<>();
    private static Map<String, List<String>> historial = new ConcurrentHashMap<>();
    private static Map<String, String> usuarios = new ConcurrentHashMap<>();
    private static Map<String, ClientHandler> usuariosConectados = new ConcurrentHashMap<>();
    
    private ExecutorService pool;
    private static Semaphore semaphore;

    public static void main(String[] args) {
        ChatServer servidor = new ChatServer();
        servidor.iniciarServidores();
    }

    public ChatServer() {
        ChatServer.semaphore = new Semaphore(5);
        this.pool = Executors.newCachedThreadPool();
    }

    public void iniciarServidores() {
        System.out.println("===========================================");
        System.out.println("INICIANDO SERVICIOS:");
        System.out.println("• Servidor Socket tradicional: puerto " + SOCKET_PORT);
        System.out.println("• Servidor Ice WebSocket: puerto " + ICE_PORT);
        System.out.println("===========================================");

        // Iniciar Ice en hilo separado
        new Thread(this::iniciarIce).start();
        
        // Mantener servidor socket actual
        iniciarSocket();
    }

    // NUEVO MÉTODO: Servidor Ice
    private void iniciarIce() {
        try {
            Communicator communicator = Util.initialize();
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter", "ws -p " + ICE_PORT);
            
            adapter.add(new ChatServiceI(), Util.stringToIdentity("ChatService"));
            adapter.activate();
            
            System.out.println("✅ Servidor Ice WebSocket LISTO en puerto " + ICE_PORT);
            communicator.waitForShutdown();
            
        } catch (Exception e) {
            System.err.println("❌ Error en servidor Ice: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // MÉTODO EXISTENTE (casi igual)
    private void iniciarSocket() {
        try (java.net.ServerSocket serverSocket = new java.net.ServerSocket(SOCKET_PORT)) {
            while (true) {
                java.net.Socket clientSocket = serverSocket.accept();
                System.out.println("Cliente socket conectado: " + clientSocket.getInetAddress());

                ClientHandler handler = new ClientHandler(clientSocket, this);
                try {
                    semaphore.acquire();
                    pool.execute(handler);
                } catch (InterruptedException e) {
                    System.err.println("Error al adquirir semáforo: " + e.getMessage());
                }
            }
        } catch (java.io.IOException e) {
            System.err.println("Error en servidor socket: " + e.getMessage());
            e.printStackTrace();
        } finally {
            pool.shutdown();
        }
    }

    // TUS MÉTODOS GETTERS EXISTENTES (NO CAMBIAN)
    public static Map<String, ClientHandler> getClientesConectados() {
        return clientesConectados;
    }

    public static Map<String, List<String>> getGrupos() {
        return grupos;
    }

    public static Map<String, List<String>> getHistorial() {
        return historial;
    }

    public static Map<String, String> getUsuarios() {
        return usuarios;
    }

    public static Semaphore getSemaphore() {
        return semaphore;
    }

    public static Map<String, ClientHandler> getUsuariosConectados() {
        return usuariosConectados;
    }

    // MÉTODOS DE BROADCAST EXISTENTES (NO CAMBIAN)
    public static void broadcastToAll(String message) {
        for (ClientHandler client : clientesConectados.values()) {
            client.enviarRespuesta(message);
        }
    }

    public static void sendToUser(String username, String message) {
        ClientHandler client = usuariosConectados.get(username);
        if (client != null) {
            client.enviarRespuesta(message);
        }
    }
}