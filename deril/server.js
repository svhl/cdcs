const express = require('express');
const https = require('https');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());

// MongoDB Atlas connection details
const mongoUri = 'mongodb+srv://deril:deril@pcbuilder.7lis3so.mongodb.net/?retryWrites=true&w=majority&appName=pcbuilder';
const dbName = 'cdcs';
const flaggedCollection = 'flagged';

// Handle POST requests from clients
app.post('/message', async (req, res) => {
    console.log(req.body);
    if (req.body.msg_type === 1001) {
        // Prepare document without msg_type
        const { msg_type, ...doc } = req.body;
        let client;
        try {
            client = new MongoClient(mongoUri);
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(flaggedCollection);
            await collection.insertOne(doc);
            console.log('Flagged data inserted into MongoDB:', doc);
        } catch (e) {
            console.error('MongoDB error:', e);
        } finally {
            if (client) await client.close();
        }
    }
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
