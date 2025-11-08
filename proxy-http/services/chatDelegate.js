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

    client.on('data', chunk => data += chunk.toString());
    client.on('end', () => resolve(data));
    client.on('error', reject);
  });
}

module.exports = { sendToChatServer };
