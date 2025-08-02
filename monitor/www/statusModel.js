$(document).ready(function () {
    $('#statusTable').DataTable({
        "paging": false, "info": false,
        "columnDefs": [
            { "className": "dt-center", "targets": "_all" }
        ],
    });

    var clients = [];

    let statusBars = new Vue({
        el: "#statusColors",
        data: function data() {
            return { clients: clients, componentKey: 0 };
        },
        methods:
        {
            forceRerender() {
                this.componentKey += 1;
            }
        }
    })

    let table = new Vue({
        el: '#statusTable',
        data: function data() {
            return {
                clients: clients,
                componentKey: 0,
            };
        },
        methods:
        {
            forceRerender() {
                this.componentKey += 1;
            }
        }
    });

    const host = `${window.location.hostname}:3000`;
    console.log(`Connecting to ${host}`);
    var socket = io(host, {
        transports: ['websocket']
    });

    console.log(socket);

    socket.on("heartbeat", (heartbeat) => {
        console.log(JSON.stringify(heartbeat));
        table.clients = heartbeat.servers;
        statusBars.clients = heartbeat.servers;
    });
});
