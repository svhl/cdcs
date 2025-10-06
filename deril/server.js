const express = require('express');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { MongoClient } = require('mongodb');
const { execFile } = require('child_process');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
app.use(express.json());

// Enable pretty-printing of JSON responses.
// This will indent the JSON with 2 spaces, making it more readable.
app.set('json spaces', 2);

// MongoDB Atlas connection details
// The MongoDB URI is now loaded from the .env file for better security.
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error('Error: MONGO_URI is not defined in the .env file.');
    process.exit(1);
}
const dbName = 'cdcs';

// --- Refactored MongoDB Connection ---
// Create a single MongoClient instance to be reused across the application.
// This is much more efficient than creating a new connection for every request.
const client = new MongoClient(mongoUri);
let db;

async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db(dbName);
        console.log('Successfully connected to MongoDB Atlas!');
    } catch (e) {
        console.error('Failed to connect to MongoDB', e);
        // If the database connection fails, the application can't function.
        process.exit(1);
    }
}

// --- Authentication Middleware ---
// In a production environment, store these keys securely (e.g., environment variables, secret manager)
// API Keys are now loaded from the .env file.
const apiKeys = process.env.API_KEYS || '';
const VALID_API_KEYS = new Set(apiKeys.split(',').filter(Boolean));
if (VALID_API_KEYS.size === 0) {
    console.warn('Warning: No API_KEYS found in .env file. API endpoints will be inaccessible.');
}

const requireApiKey = (req, res, next) => {
    const apiKey = req.get('X-API-Key');
    if (apiKey && VALID_API_KEYS.has(apiKey)) {
        // The request has a valid API key, so we can proceed.
        return next();
    }
    // If the key is missing or invalid, we send a 401 Unauthorized response.
    res.status(401).json({ error: 'Unauthorized: A valid X-API-Key header is required.' });
};

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
            const flaggedCollectionRef = db.collection('flagged');
            const packagesCollectionRef = db.collection('packages');
            await flaggedCollectionRef.insertOne(doc);
            console.log('Flagged data inserted into MongoDB:', doc);
            // Run delete_packages.sh with only non-whitelisted new_packages as arguments
            if (Array.isArray(doc.new_packages) && doc.new_packages.length > 0) {
                const scriptPath = require('path').join(__dirname, '../juan/delete_packages.sh');
                execFile(scriptPath, doc.new_packages, (err, stdout, stderr) => {
                    if (err) {
                        console.error('Error running delete_packages.sh:', err);
                        return;
                    }
                    console.log('delete_packages.sh output:', stdout);
                });
            } else {
                console.log('No unauthorized packages to delete.');
            }
        } catch (e) {
            console.error('MongoDB error:', e);
        } finally {
            if (client) await client.close();
        }
    }
    res.json({ reply: 'Message received' });
});

// --- Generic Read-Only Endpoint Factory ---
// This function creates a protected, read-only endpoint for a given collection.
// This avoids code duplication for /flagged, /employees, and /packages.
const createReadOnlyEndpoint = (path, collectionName) => {
    app.get(path, requireApiKey, async (req, res) => {
        try {
            const collection = db.collection(collectionName);
            const data = await collection.find({}).toArray();
            res.json(data);
        } catch (e) {
            console.error(`MongoDB error on ${path}:`, e);
            res.status(500).json({ error: 'Database error' });
        }
    });
};

// Create the protected, read-only API endpoints
createReadOnlyEndpoint('/flagged', 'flagged');
createReadOnlyEndpoint('/employees', 'employees');
createReadOnlyEndpoint('/packages', 'packages');

// --- Server Startup ---
const startServer = async () => {
    // 1. Connect to the database first
    await connectToDatabase();

    // 2. Load SSL certificates
    const options = {
        key: fs.readFileSync('server.key'), // Path to your key
        cert: fs.readFileSync('server.cert') // Path to your certificate
    };

    // 3. Start the HTTPS server
    https.createServer(options, app).listen(3000, '0.0.0.0', () => {
        console.log('HTTPS Express server listening on port 3000');
        // A cleaner way to log network interfaces
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const net of interfaces[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`Server available on LAN at: https://${net.address}:3000`);
                }
            }
        }
    });
};

startServer();
