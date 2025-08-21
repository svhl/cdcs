const https = require('https');

const data = JSON.stringify({ message: 'Hello from client!' });

const options = {
    hostname: '192.168.174.129', // <-- Use this as your server's LAN IP
    port: 3000,
    path: '/message',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    },
    rejectUnauthorized: false // For self-signed certificates
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    res.on('end', () => {
        console.log('Received from server:', responseData);
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.write(data);
req.end();
