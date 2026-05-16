const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: port });

const clients = new Map();
const claimLocks = new Map();

wss.on('connection', (ws) => {
    clients.set(ws, "");
    console.log("New client connected!");
    ws.msgCount = 0;
    ws.lastMsgTime = Date.now();

    ws.on('message', (message) => {
        if (Buffer.byteLength(message) > 50000) {
            console.warn("Client kicked: Payload too large.");
            ws.close(1009, "Payload Too Large");
            return;
        }

        const now = Date.now();
        if (now - ws.lastMsgTime > 1000) {
            ws.msgCount = 0;
            ws.lastMsgTime = now;
        }
        ws.msgCount++;

        if (ws.msgCount > 15) {
            console.warn("Client kicked: Rate limit exceeded.");
            ws.close(1008, "Rate Limit Exceeded");
            return;
        }

        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe') {
                const chunk_id = data.chunk_id || "";
                clients.set(ws, chunk_id);
                console.log(`Client subscribed to chunk: ${chunk_id}`);

                for (let lockData of claimLocks.values()) {
                    ws.send(JSON.stringify(lockData));
                }

                const stringifiedData = JSON.stringify(data);
                for (let [client, sub] of clients.entries()) {
                    if (client === ws) continue;
                    if (client.readyState === 1 && sub !== "") {
                        client.send(stringifiedData);
                    }
                }
            }
            else if (data.type === 'edit_plot' || data.type === 'claim_plot' || data.type === 'unclaim_plot') {
                if (data.type === 'claim_plot') {
                    if (claimLocks.has(ws)) {
                        const oldLock = claimLocks.get(ws);
                        if (oldLock.plot_x !== data.plot_x || oldLock.plot_y !== data.plot_y || oldLock.plot_z !== data.plot_z) {
                            oldLock.type = 'unclaim_plot';
                            const unclaimStr = JSON.stringify(oldLock);
                            for (let [client, sub] of clients.entries()) {
                                if (client !== ws && client.readyState === 1 && sub !== "") {
                                    client.send(unclaimStr);
                                }
                            }
                        }
                    }
                    claimLocks.set(ws, data);
                } else if (data.type === 'unclaim_plot') {
                    claimLocks.delete(ws);
                }

                const stringifiedData = JSON.stringify(data);
                for (let [client, sub] of clients.entries()) {
                    if (client === ws) continue;
                    if (client.readyState !== 1) continue;
                    if (sub === "") continue;
                    client.send(stringifiedData);
                }
            }
        } catch (e) {
            console.error("Malformed payload received:", e);
        }
    });

    ws.on('close', () => {
        if (claimLocks.has(ws)) {
            const lockData = claimLocks.get(ws);
            lockData.type = 'unclaim_plot';

            const stringifiedUnclaim = JSON.stringify(lockData);
            for (let [client, sub] of clients.entries()) {
                if (client.readyState === 1 && sub !== "") {
                    client.send(stringifiedUnclaim);
                }
            }
            claimLocks.delete(ws);
        }

        clients.delete(ws);
        console.log("Client disconnected.");
    });
});

console.log(`CADPlace WebSocket Server running on port ${port}...`);
