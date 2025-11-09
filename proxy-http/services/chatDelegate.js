const net = require('net');
const SERVER_HOST = 'localhost';
const SERVER_PORT = 5000;

function sendToChatServer(json) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = '';

    client.connect(SERVER_PORT, SERVER_HOST, () => {
      client.write(json + '\n');
    });

    client.on('data', chunk => {
      data += chunk.toString();

      if (data.includes('\n')) {
        resolve(data.trim());
        client.end();
      }
    });

    client.on('error', err => {
      reject(err);
    });
  });
}

module.exports = { sendToChatServer };
