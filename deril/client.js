const https = require('https');
const { execFile } = require('child_process');
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
            // Get username
            const username = os.userInfo().username;
            // Get MAC address of first non-internal interface
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
            // Get current date and time in ISO format
            const timestamp = new Date().toISOString();
            // Prepare data to send as JSON
            const postData = JSON.stringify({ msg_type: 1001, timestamp, username, mac_address, new_packages: newPackages });

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
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                res.on('end', () => {
                    console.log('Received from server:', responseData);
                    // After successful send, run delete_Packages.sh with flagged packages
                    if (newPackages.length > 0) {
                        const deleteScript = path.join(__dirname, '../juan/delete_packages.sh');
                        const child = execFile(deleteScript, newPackages, (err, stdout, stderr) => {
                            if (err) {
                                console.error('Error running delete_packages.sh:', err);
                                return;
                            }
                            console.log('delete_packages.sh output:', stdout);
                        });
                    }
                });
            });

            req.on('error', (e) => {
                console.error(e);
            });

            req.write(postData);
            req.end();
        } catch (e) {
            console.error('MongoDB error:', e);
        } finally {
            if (client) await client.close();
        }
    });
});
