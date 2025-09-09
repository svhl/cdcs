const https = require('https');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run the shell script
execFile(path.join(__dirname, '../juan/list_packages.sh'), (err, stdout, stderr) => {
    if (err) {
        console.error('Error running list_packages.sh:', err);
        return;
    }
    // Get list from script output
    const scriptPackages = stdout.split('\n').map(x => x.trim()).filter(Boolean);

    // Read packages.txt
    fs.readFile(path.join(__dirname, '../juan/default_packages.txt'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading packages.txt:', err);
            return;
        }
        const knownPackages = new Set(data.split('\n').map(x => x.trim()).filter(Boolean));
        // Find packages not in packages.txt
        const newPackages = scriptPackages.filter(pkg => !knownPackages.has(pkg));
        if (newPackages.length === 0) {
            console.log('No new packages to send.');
            return;
        }
        // Prepare data to send
        const postData = JSON.stringify({ new_packages: newPackages });

        const options = {
            hostname: '192.168.174.129',
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
            });
        });

        req.on('error', (e) => {
            console.error(e);
        });

        req.write(postData);
        req.end();
    });
});
