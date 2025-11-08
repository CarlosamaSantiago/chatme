package com.chat.servidor;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

public class ChatServer {

    private static final int PORT = 5000;
    private static Map<String, ClientHandler> clientesConectados = new ConcurrentHashMap<>();
    private static Map<String, List<String>> grupos = new ConcurrentHashMap<>();
    private static Map<String, List<String>> historial = new ConcurrentHashMap<>();
    private static Map<String, String> usuarios = new ConcurrentHashMap<>();
    private ExecutorService pool;
    private static Semaphore semaphore;

    public static void main(String[] args) {
        ChatServer servidor = new ChatServer(PORT);
        servidor.iniciar();
    }

    public ChatServer(int puerto) {
        this.semaphore = new Semaphore(5); 
        this.pool = Executors.newCachedThreadPool();
    }

    public void iniciar() {
        System.out.println("===========================================");
        System.out.println("Servidor de Chat iniciado en puerto " + PORT);
        System.out.println("===========================================");
        
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            while (true) {
                Socket clientSocket = serverSocket.accept();
                System.out.println("Cliente conectado: " + clientSocket.getInetAddress());
                
                ClientHandler handler = new ClientHandler(clientSocket, this);
                try {
                    semaphore.acquire();
                    pool.execute(handler);
                } catch (InterruptedException e) {
                    System.err.println("Error al adquirir semáforo: " + e.getMessage());
                }
            }
        } catch (IOException e) {
            System.err.println("Error en el servidor: " + e.getMessage());
            e.printStackTrace();
        } finally {
            pool.shutdown();
        }
    }

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

    public static void broadcastToAll(String message) {
        for (ClientHandler client : clientesConectados.values()) {
            client.enviarRespuesta(message);
        }
    }

    public static void sendToUser(String username, String message) {
        for (Map.Entry<String, String> entry : usuarios.entrySet()) {
            if (entry.getValue().equals(username)) {
                ClientHandler client = clientesConectados.get(entry.getKey());
                if (client != null) {
                    client.enviarRespuesta(message);
                }
            }
        }
    }
}