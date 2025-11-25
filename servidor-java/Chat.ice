module Chat{

    struct MessageDTO{
        string from;
        string to;
        string message;
        string timestamp;
        bool isGroup;
    }

    sequence<string> StringArray;
    sequence<MessageDTO> MessageArray;

    interface ChatServices{
        void registerUser(string username);
        StringArray getUsers();
        StringArray getGroups();
        void createGroup(string groupName);
        void sendMessage(string from, string to, string message, bool isGroup);
        MessageArray getHistory(string target, string from, bool isGroup);
    }

    interface Observer{
        void notifyMessage(string message);
        void notifyNewUser(string username);
        void notifyNewGroup(string groupName);
        void notifyNewMessage(MessageDTO message);
    }
    
    interface Subject{
        void attachObserver(Observer* objs);
    }

}

