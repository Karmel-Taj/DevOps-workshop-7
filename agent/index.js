const fs = require('fs').promises;
const { createServer } = require('http');
const { Server } = require('socket.io');

class Agent {
    constructor() {
        this.lastCpuCheck = Date.now();
        this.lastCpuUsage = 0;
    }

    async memoryLoad() {
        // TODO: calculate memory load
        // see:
        // /sys/fs/cgroup/memory.current
        // /sys/fs/cgroup/memory.max
        try {

            let usedRaw, limitRaw;

            try {
                // Try cgroup v1 first
                usedRaw = await fs.readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8');
                limitRaw = await fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8');
            } catch {


                const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
                const lines = meminfo.split('\n');

                const totalMatch = lines.find(line => line.startsWith('MemTotal:'));
                const availableMatch = lines.find(line => line.startsWith('MemAvailable:'));

                if (totalMatch && availableMatch) {
                    const total = parseInt(totalMatch.split(/\s+/)[1]) * 1024;
                    const available = parseInt(availableMatch.split(/\s+/)[1]) * 1024;
                    const used = total - available;
                    const percent = (used / total) * 100;
                    return +percent.toFixed(2);
                }

                return 0;

            }

            const used = parseInt(usedRaw.trim());
            const limit = parseInt(limitRaw.trim());

            if (limit <= 0 || limit > 9223372036854775807) {
                const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
                const lines = meminfo.split('\n');

                const totalMatch = lines.find(line => line.startsWith('MemTotal:'));
                const availableMatch = lines.find(line => line.startsWith('MemAvailable:'));

                if (totalMatch && availableMatch) {
                    const total = parseInt(totalMatch.split(/\s+/)[1]) * 1024;
                    const available = parseInt(availableMatch.split(/\s+/)[1]) * 1024;
                    const usedMem = total - available;
                    const percent = (usedMem / total) * 100;
                    return +percent.toFixed(2);
                }

                return 0;
            }

            const percent = (used / limit) * 100;
            return +percent.toFixed(2);

        } catch (err) {
            console.error('Memory read error:', err.message);
            return 0;
        }
    }

    async cpuLoad() {
        // TODO: calculate cpu load
        // to calculate CPU load:
        // 1. read usage_usec value from /sys/fs/cgroup/cpu.stat this is cpu time in microseconds
        // 2. store usage_usec on each run of cpuLoad() and calculate how much is increased since last run (you can store it in this.lastCpuUsage)
        // 3. store and calculate time since last time cpuLoad() was called (you can store timestamps from Date.now() and calculate the time difference)
        // 4. calculate the cpu load percentage as (usage_usec changes since last run / time since last run in seconds) * 100

        try {
            let usageRaw;

            try {
                // Try cgroup v1 first
                usageRaw = await fs.readFile('/sys/fs/cgroup/cpuacct/cpuacct.usage', 'utf8');
            } catch {


                // Fallback to /proc/stat
                const stat = await fs.readFile('/proc/stat', 'utf8');
                const cpuLine = stat.split('\n')[0];
                const cpuValues = cpuLine.split(/\s+/).slice(1).map(Number);
                const totalTime = cpuValues.reduce((a, b) => a + b, 0);
                const idleTime = cpuValues[3]; // idle time is the 4th value
                const usedTime = totalTime - idleTime;

                const now = Date.now();
                const elapsedSec = (now - this.lastCpuCheck) / 1000;

                let percent = 0;
                if (this.lastCpuUsage > 0 && elapsedSec > 0) {
                    const deltaUsed = usedTime - this.lastCpuUsage;
                    const deltaTotal = totalTime - this.lastTotalTime;
                    if (deltaTotal > 0) {
                        percent = (deltaUsed / deltaTotal) * 100;
                    }
                }

                this.lastCpuUsage = usedTime;
                this.lastTotalTime = totalTime;
                this.lastCpuCheck = now;

                return +Math.max(0, Math.min(100, percent)).toFixed(2);
            }


            const usageNano = parseInt(usageRaw.trim());
            const now = Date.now();
            const elapsedSec = (now - this.lastCpuCheck) / 1000;

            let percent = 0;
            if (this.lastCpuUsage > 0 && elapsedSec > 0) {
                const deltaUsage = usageNano - this.lastCpuUsage;
                percent = (deltaUsage / 1e9) / elapsedSec * 100;
            }

            this.lastCpuUsage = usageNano;
            this.lastCpuCheck = now;

            // Ensure percentage is within reasonable bounds
            return +Math.max(0, Math.min(100, percent)).toFixed(2);

        } catch (err) {
            console.error('CPU read error:', err.message);
            return 0;
        }
    }
}

let requestsThisSecond = 0;
let requestsThisMinute = 0;
const agent = new Agent();
setInterval(() => { requestsThisSecond = 0; }, 1000);
setInterval(() => { requestsThisMinute = 0; }, 60000);
const httpServer = createServer((req, res) => {
    requestsThisSecond++;
    requestsThisMinute++;
});
const io = new Server(httpServer, {
    transports: ['websocket'],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Agent connected to monitor');

    const interval = setInterval(async () => {
        const memoryLoad = await agent.memoryLoad();
        const cpuLoad = await agent.cpuLoad();
        console.log({ memoryLoad, cpuLoad });
        socket.emit('monitoring-stats', {
            memoryLoad,
            cpuLoad,
            requestsPerSecond: requestsThisSecond,
            requestsPerMinute: requestsThisMinute
        });
    }, 1000);

    socket.on('ping', (data, callback) => {
        if (callback) callback(); // Respond immediately for latency measurement
    });

    socket.on('disconnect', () => {
        console.log('Monitor disconnected');
        clearInterval(interval);
    });
});

const port = process.env.AGENT_PORT || 5001;
httpServer.listen(port, () => {
    console.log(`Agent listening on port ${port}!`);
});