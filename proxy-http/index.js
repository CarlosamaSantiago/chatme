const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sendToChatServer } = require('./services/chatDelegate');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/createGroup', async (req, res) => {
  const msg = JSON.stringify({
    action: "CREATE_GROUP",
    groupName: req.body.groupName
  });
  const respuesta = await sendToChatServer(msg);
  res.send(respuesta);
});

app.post('/sendMessage', async (req, res) => {
  const msg = JSON.stringify({
    action: "SEND_MESSAGE",
    from: req.body.from,
    to: req.body.to,
    message: req.body.message
  });
  const respuesta = await sendToChatServer(msg);
  res.send(respuesta);
});

// Aún hace falta pensar la lógica de los registros/historial
// Aún hace falta pensar la lógica de añadir una persona a un grupo

app.listen(3000, () => console.log('Proxy HTTP en puerto 3000'));
