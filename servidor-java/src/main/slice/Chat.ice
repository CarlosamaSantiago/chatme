module Chat {
    sequence<string> StringList;
    
    struct Message {
        string from;
        string to;
        string message;
        string timestamp;
        bool isGroup;
    };
    sequence<Message> MessageList;

    exception ChatException {
        string reason;
    };

    // Interfaz para Workers (manejo de mensajes)
    interface ChatWorker {
        void deliverMessage(Message msg);
        void updateUserList(StringList users);
        void updateGroupList(StringList groups);
    };

    // Interfaz para Master (coordinación)
    interface ChatMaster {
        void registerWorker(string workerId, ChatWorker workerPrx);
        void unregisterWorker(string workerId);
        void registerUser(string username, string workerId) throws ChatException;
        void createGroup(string groupName, string workerId) throws ChatException;
        void sendMessage(Message msg) throws ChatException;
        StringList getUsers();
        StringList getGroups();
        MessageList getHistory(string target, string fromUser, bool isGroup);
    };
};