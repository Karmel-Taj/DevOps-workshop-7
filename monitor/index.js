const express = require('express');
const app = express();
const httpServer = require('http').Server(app);
const { Server } = require('socket.io');
const { io } = require("socket.io-client");

app.use(express.static('www'));

// TODO: update these if you used different ports!
const servers = [
    // { name: "computer", url: `http://localhost`, port: 5005, status: "#cccccc", scoreTrend: [] }, // you can also monitor your local machine
    { name: "server-01", url: `http://localhost`, port: 5001, status: "#cccccc", scoreTrend: [0] },
    { name: "server-02", url: `http://localhost`, port: 5002, status: "#cccccc", scoreTrend: [0] },
    { name: "server-03", url: `http://localhost`, port: 5003, status: "#cccccc", scoreTrend: [0] }
];

// ==================================================
// Connect to the Agent websocket servers
// ==================================================

for (const server of servers) {
    const agentSocket = io(server.url + ':' + server.port, { transports: ['websocket'] })
    if (!agentSocket) {
        console.log('Did not connect to', server.name);
        continue;
    }
    server.agentSocket = agentSocket; // Store the socket in the server object
    console.log('Server connected:', server.name);
    agentSocket.on('monitoring-stats', async (data) => {
        console.log('monitoring-stats', data);
        // process.exit(1);
        // update servers array to set this server status.
        server.memoryLoad = data.memoryLoad;
        server.cpuLoad = data.cpuLoad;
        server.requestsPerSecond = data.requestsPerSecond;
        server.requestsPerMinute = data.requestsPerMinute;
        updateHealth(server);
    });
}

// ==================================================
// Monitor socket to send data to the dashboard front-end
// ==================================================

const monitorSocket = new Server(httpServer, {
    transports: ['websocket'],
    cors: {
        origin: "https://example.com",
        methods: ["GET", "POST"]
    }
});
monitorSocket.on('connection', socket => {
    console.log('Monitoring dashboard connected');
    const heartbeatInterval = setInterval(() => {
        // Create a safe copy without agentSocket
        const safeServers = servers.map(({ agentSocket, ...rest }) => rest);
        socket.emit('heartbeat', { servers: safeServers });
    }, 1000);

    socket.on('disconnect', () => {
        clearInterval(heartbeatInterval);
    });
});

// ==================================================
// Latency calculation
// ==================================================

// TODO:
setInterval(() => {
    for (const server of servers) {
        if (!server.agentSocket) continue;
        const start = Date.now();
        server.latency = undefined;
        server.agentSocket.emit('ping', {}, () => {
            server.latency = Date.now() - start;
            server.statusCode = 200;
        });

        setTimeout(() => {
            if (typeof server.latency === 'undefined') {
                server.latency = null;
                server.statusCode = null;
            }
        }, 1000);
    }
}, 1000);



// ==================================================
// Score calculation
// ==================================================

// TODO:
function updateHealth(server) {
    let score = 0;

    // CPU load
    if (server.cpuLoad < 10) {
        score += 1;
    } else if (server.cpuLoad > 90) {
        score -= 1;
    } else {
        score += ((server.cpuLoad - 10) / 80) * 1;
    }

    // Memory load
    if (server.memoryLoad < 10) {
        score += 1;
    } else if (server.memoryLoad > 90) {
        score -= 1;
    } else {
        score += ((server.memoryLoad - 10) / 80) * 1;
    }

    // Latency
    if (server.latency < 10) {
        score += 1;
    } else if (server.latency > 1000) {
        score -= 1;
    } else if (server.latency > 100) {
        score += 0.25;
    }

    // Status code: penalize if not 200
    if (server.statusCode !== 200) score -= 0.125;
    if (server.statusCode == 200) score += 0.125;

    // Clamp score to [0, 4]
    score = Math.min(score, 4);

    server.status = score2color(score / 4);

    // Add score to trend data.
    server.scoreTrend.push(score);
    if (server.scoreTrend.length > 100) {
        server.scoreTrend.shift();
    }
}

function score2color(score) {
    if (score <= 0.25) return "#ff0000";
    if (score <= 0.50) return "#ffcc00";
    if (score <= 0.75) return "#00cc00";
    return "#006affff";
}

// ==================================================

httpServer.listen(3000, () => {
    console.log('Example app listening on port 3000!');
});
