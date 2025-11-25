package com.chat.servidor.services;

import java.util.ArrayList;
import java.util.List;

import com.zeroc.Ice.Current;

import Chat.ObserverPrx;
import Chat.Subject;
import Chat.MessageDTO;

public class SubjectImpl implements Subject {

    private List<ObserverPrx> list;

    public SubjectImpl() {
        list = new ArrayList<>();
    }

    @Override
    public void attachObserver(ObserverPrx objs, Current current) {
        System.out.println("Attach");
        System.out.println("Nuevo observer conectado: " + objs.ice_getIdentity());
        
        // Se asocia el proxy sobre la misma conexión abierta desde el cliente
        ObserverPrx proxy = objs.ice_fixed(current.con);
        list.add(proxy);

        // Se define un callback para manejar el cierre de la conexión
        if (current.con != null) {
            current.con.setCloseCallback(connection -> {
                System.out.println("Conexión cerrada, eliminando observer: " + objs.ice_getIdentity());
                list.remove(proxy);
            });
        }
    }

    public void notifyNewUser(String username) {
        System.out.println("notifyNewUser: " + list.size());
        List<ObserverPrx> disconnected = new ArrayList<>();

        for (ObserverPrx prx : list) {
            try {
                prx.notifyNewUser(username);
            } catch (Exception e) {
                disconnected.add(prx);
                e.printStackTrace();
            }
        }
        list.removeAll(disconnected);
    }

    public void notifyNewGroup(String groupName) {
        System.out.println("notifyNewGroup: " + list.size());
        List<ObserverPrx> disconnected = new ArrayList<>();

        for (ObserverPrx prx : list) {
            try {
                prx.notifyNewGroup(groupName);
            } catch (Exception e) {
                disconnected.add(prx);
                e.printStackTrace();
            }
        }
        list.removeAll(disconnected);
    }

    public void notifyNewMessage(MessageDTO message) {
        System.out.println("notifyNewMessage: " + list.size());
        List<ObserverPrx> disconnected = new ArrayList<>();

        for (ObserverPrx prx : list) {
            try {
                prx.notifyNewMessage(message);
            } catch (Exception e) {
                disconnected.add(prx);
                e.printStackTrace();
            }
        }
        list.removeAll(disconnected);
    }

    public void notifyMessage(String message) {
        System.out.println("notifyMessage: " + list.size());
        List<ObserverPrx> disconnected = new ArrayList<>();

        for (ObserverPrx prx : list) {
            try {
                prx.notifyMessage(message);
            } catch (Exception e) {
                disconnected.add(prx);
                e.printStackTrace();
            }
        }
        list.removeAll(disconnected);
    }
}

