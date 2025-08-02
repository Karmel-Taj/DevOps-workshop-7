const { spawn, spawnSync } = require('child_process');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/memory-load', (req, res) => {
    spawn('stress-ng --vm 1 --vm-bytes 300M --vm-keep --vm-hang 0 --timeout 30s --metrics-brief', { shell: true });
    res.send('Memory stress-ng, started for 30 seconds');
});

app.get('/cpu-load', (req, res) => {
    spawn('stress-ng --cpu 1 --cpu-load 50 --timeout 30s --metrics-brief', { shell: true });
    res.send('CPU stress-ng, started for 30 seconds');
});

app.get('/max-load', (req, res) => {
    spawn('stress-ng --cpu 1 --cpu-load 99 --vm 1 --vm-bytes 1G --timeout 30s --metrics-brief', { shell: true });
    res.send('Max stress-ng, started for 30 seconds');
});

// ensure stress-ng is installed
spawnSync('apk update && apk add -y stress-ng', { shell: true });

app.listen(process.env.SERVER_PORT || 4001, () => {
    console.log('Server listening on port ' + process.env.SERVER_PORT || 4001 + '!');
});
