module Chat {

    // Secuencia de bytes para datos de audio
    sequence<byte> ByteSeq;

    // Mensaje del chat
    struct Message {
        string from;
        string to;
        string content;
        long timestamp;
        bool isGroup;
        string type;
        ByteSeq data;
    };

    // Secuencia de mensajes
    sequence<Message> MessageSeq;

    // Secuencia de strings
    sequence<string> StringSeq;

    // Excepciones
    exception ChatException {
        string reason;
    };

    // Callback del cliente
    interface MessageCallback {
        void onMessage(Message msg);
        void onGroupMessage(Message msg, string groupName);
    };

    // Servicio principal
    interface ChatService {
        void registerUser(string username) throws ChatException;
        void createGroup(string groupName) throws ChatException;

        void sendMessage(string from, string to, string content, bool isGroup)
            throws ChatException;

        void sendAudio(string from, string to, ByteSeq data, bool isGroup)
            throws ChatException;

        void startCall(string from, string to, bool isGroup)
            throws ChatException;

        MessageSeq getHistory(string target, string fromUser, bool isGroup)
            throws ChatException;

        StringSeq getUsers() throws ChatException;
        StringSeq getGroups() throws ChatException;

        void subscribe(MessageCallback* callback, string username) throws ChatException;
        void unsubscribe(string username) throws ChatException;
    };
};
