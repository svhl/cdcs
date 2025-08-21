const express = require('express');
const https = require('https');
const fs = require('fs');

const app = express();
app.use(express.json());

// Handle POST requests from clients
app.post('/message', (req, res) => {
    console.log('Received from client:', req.body.message);
    res.json({ reply: 'Message received' });
});

// Load self-signed certificate and key (generate with openssl for local testing)
const options = {
    key: fs.readFileSync('server.key'), // Path to your key
    cert: fs.readFileSync('server.cert') // Path to your certificate
};

https.createServer(options, app).listen(3000, '0.0.0.0', () => {
    console.log('HTTPS Express server listening on port 3000');
    console.log('Server LAN IP:', require('os').networkInterfaces());
});
