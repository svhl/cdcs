const net = require('net');
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');

const SOCKET_PATH = '/var/run/cdcs-helper.sock';
const DELETE_SCRIPT_PATH = path.join(__dirname, '../juan/delete_packages.sh');

// --- Security Check ---
// Ensure this service is running as root.
if (process.getuid() !== 0) {
    console.error('Error: This service must be run as root.');
    process.exit(1);
}

const server = net.createServer((client) => {
    console.log('Helper: Client connected.');

    client.on('data', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.action === 'delete_packages' && Array.isArray(message.packages)) {
                console.log('Helper: Received request to delete:', message.packages);

                // The service is already root, so we don't need sudo in the command.
                // We will modify delete_packages.sh to not use sudo.
                execFile(DELETE_SCRIPT_PATH, message.packages, (err, stdout, stderr) => {
                    if (err) {
                        console.error('Helper: Error executing delete script:', stderr);
                        client.write(JSON.stringify({ status: 'error', message: stderr || 'Unknown error' }));
                        return;
                    }
                    console.log('Helper: Script output:', stdout);
                    // Send a clear success status and include the script's output
                    client.write(JSON.stringify({ status: 'success', output: stdout, deletedPackages: message.packages }));
                });
            }
        } catch (e) {
            console.error('Helper: Invalid data from client:', e.message);
            client.write(JSON.stringify({ status: 'error', message: 'Invalid request format.' }));
        }
    });

    client.on('end', () => {
        console.log('Helper: Client disconnected.');
    });
});

// --- Server Startup ---

// 1. Clean up any old socket file before starting the server.
// This prevents EADDRINUSE errors if the server crashed previously.
if (fs.existsSync(SOCKET_PATH)) {
    fs.unlinkSync(SOCKET_PATH);
}

// 2. Start the server and listen on the socket path.
server.listen(SOCKET_PATH, () => {
    console.log(`Helper service listening on ${SOCKET_PATH}`);
    // 3. Set permissions on the newly created socket file.
    // This is safe to do inside the callback, as the file is guaranteed to exist.
    fs.chmodSync(SOCKET_PATH, '666');
});

// Gracefully shut down and clean up the socket file.
const cleanup = () => {
    console.log('Helper: Shutting down...');
    if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
    }
    process.exit();
};

process.on('SIGINT', cleanup); // Catches Ctrl+C
process.on('SIGTERM', cleanup); // Catches standard kill signals