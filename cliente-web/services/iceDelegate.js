import subscriber from './subscriber.js';

export class IceDelegate {
  constructor() {
    this.communicator = Ice.initialize();
    this.service = null;
    this.subject = null;
  }

  async init() {
    if (this.service) {
      return;
    }
    const hostname = 'localhost';
    const proxy = this.communicator.stringToProxy(
      `Service:ws -h ${hostname} -p 9099`
    );
    this.service = await Chat.ChatServicesPrx.checkedCast(proxy);

    const proxySubject = this.communicator.stringToProxy(
      `Subject:ws -h ${hostname} -p 9099`
    );
    this.subject = await Chat.SubjectPrx.checkedCast(proxySubject);

    const adapter = await this.communicator.createObjectAdapter('');
    
    const conn = this.subject.ice_getCachedConnection();
    conn.setAdapter(adapter);
    
    const callbackPrx = Chat.ObserverPrx.uncheckedCast(
      adapter.addWithUUID(subscriber)
    );

    await this.subject.attachObserver(callbackPrx);
  }

  async registerUser(username) {
    if (!this.service) {
      await this.init();
    }
    await this.service.registerUser(username);
  }

  async getUsers() {
    if (!this.service) {
      await this.init();
    }
    return await this.service.getUsers();
  }

  async getGroups() {
    if (!this.service) {
      await this.init();
    }
    return await this.service.getGroups();
  }

  async createGroup(groupName) {
    if (!this.service) {
      await this.init();
    }
    await this.service.createGroup(groupName);
  }

  async sendMessage(from, to, message, isGroup) {
    if (!this.service) {
      await this.init();
    }
    await this.service.sendMessage(from, to, message, isGroup);
  }

  async getHistory(target, from, isGroup) {
    if (!this.service) {
      await this.init();
    }
    return await this.service.getHistory(target, from, isGroup);
  }
}

const instance = new IceDelegate();
export default instance;

