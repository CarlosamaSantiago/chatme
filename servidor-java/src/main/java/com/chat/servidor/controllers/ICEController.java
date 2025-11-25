package com.chat.servidor.controllers;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;

import com.chat.servidor.services.ServiceIceImpl;
import com.chat.servidor.services.ServicesImpl;
import com.chat.servidor.services.SubjectImpl;

public class ICEController {

    public void init(ServicesImpl servicesImpl, String[] configs) {
        Communicator communicator = Util.initialize(configs);
        // Se puede configurar un ThreadPool en Ice. En este caso, se define con un tamaño de 5.
        communicator.getProperties().setProperty("Ice.ThreadPool.Server.Size", "5");

        SubjectImpl imp = new SubjectImpl();
        ServiceIceImpl service = new ServiceIceImpl(servicesImpl, imp);

        ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints("IceService", "ws -h localhost -p 9099");

        adapter.add(service, Util.stringToIdentity("Service"));
        adapter.add(imp, Util.stringToIdentity("Subject"));
        adapter.activate();

        System.out.println("Servidor ICE iniciado en puerto 9099 (WebSocket)");
        communicator.waitForShutdown();
    }
}

