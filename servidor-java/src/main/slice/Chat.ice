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

    interface ChatService {
        void register(string username) throws ChatException;
        void createGroup(string groupName) throws ChatException;
        void sendMessage(string from, string to, string message, bool isGroup) throws ChatException;
        StringList getUsers();
        StringList getGroups();
        MessageList getHistory(string target, string fromUser, bool isGroup);
    };
};