const https = require('https');
const { execFile } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const os = require('os');
require('dotenv').config(); // Load environment variables from .env file

// MongoDB Atlas connection URI and database/collection names
const mongoUri = process.env.MONGO_URI;
const serverHostname = process.env.SERVER_HOSTNAME;

if (!mongoUri || !serverHostname) {
    console.error('Error: MONGO_URI and/or SERVER_HOSTNAME are not defined in the .env file.');
    process.exit(1);
}
const dbName = 'cdcs'; // <-- Replace with your DB name
const collectionName = 'packages';

// Run the shell script
execFile(path.join(__dirname, '../juan/default_packages.sh'), async (err, stdout, stderr) => {
    if (err) {
        console.error('Error running default_packages.sh:', err);
        return;
    }
    // Get list from script output
    const scriptPackages = stdout.split('\n').map(x => x.trim()).filter(Boolean);

    // Read packages.txt
    fs.readFile(path.join(__dirname, '../juan/default_packages.txt'), 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading packages.txt:', err);
            return;
        }
        const knownPackages = new Set(data.split('\n').map(x => x.trim()).filter(Boolean));

        // Connect to MongoDB Atlas and get package names
        let client;
        try {
            client = new MongoClient(mongoUri); // Removed deprecated options
            await client.connect();
            const db = client.db(dbName);
            const collection = db.collection(collectionName);
            const dbPackagesArr = await collection.find({}, { projection: { _id: 0, name: 1 } }).toArray();
            const dbPackages = new Set(dbPackagesArr.map(pkg => pkg.name));

            // Find packages not in packages.txt and not in MongoDB
            const newPackages = scriptPackages.filter(pkg => !knownPackages.has(pkg) && !dbPackages.has(pkg));
            if (newPackages.length === 0) {
                console.log('No new packages to send.');
                return;
            }

            // --- NEW LOGIC: Delete packages first, then report to server ---

            const SOCKET_PATH = '/var/run/cdcs-helper.sock';
            const helperClient = net.createConnection({ path: SOCKET_PATH });

            helperClient.on('connect', () => {
                console.log('Client: Connected to helper service to delete packages.');
                const request = {
                    action: 'delete_packages',
                    packages: newPackages
                };
                helperClient.write(JSON.stringify(request));
            });

            helperClient.on('data', (data) => {
                const response = JSON.parse(data.toString());

                // --- STEP 2: If deletion was successful, now report to the server ---
                if (response.status === 'success') {
                    // Provide a clean, single-line confirmation of the deletion.
                    console.log(`Successfully deleted packages: ${response.deletedPackages.join(', ')}`);
                    console.log('Now reporting deletion to the central server...');

                    // Get system info for the report
                    const username = os.userInfo().username;
                    let mac_address = 'unknown';
                    const nets = os.networkInterfaces();
                    for (const name of Object.keys(nets)) {
                        for (const net of nets[name]) {
                            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                                mac_address = net.mac;
                                break;
                            }
                        }
                        if (mac_address !== 'unknown') break;
                    }
                    const timestamp = new Date().toISOString();

                    // Use the list of packages confirmed deleted by the helper
                    const postData = JSON.stringify({ msg_type: 1001, timestamp, username, mac_address, new_packages: response.deletedPackages });

                    const options = {
                        hostname: serverHostname,
                        port: 3000,
                        path: '/message',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        },
                        rejectUnauthorized: false
                    };

                    const req = https.request(options, (res) => {
                        // We don't need to see the server's raw response, just confirm it was logged.
                        res.on('data', () => { /* Do nothing with the response chunks */ });
                        res.on('end', () => {
                            console.log('Deletion was logged successfully by the server.');
                        });
                    });

                    req.on('error', (e) => console.error('Error reporting to server:', e));
                    req.write(postData);
                    req.end();

                } else {
                    console.error('Deletion failed. Will not report to server. Error:', response.message);
                }
                helperClient.end();
            });

            helperClient.on('error', (err) => {
                console.error('Client: Could not connect to helper service. Is it running as root?', err.message);
            });

        } catch (e) {
            console.error('MongoDB error:', e);
        } finally {
            if (client) await client.close();
        }
    });
});
