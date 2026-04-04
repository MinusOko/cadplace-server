const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080; 
const wss = new WebSocketServer({ port: port });

const clients = new Map();
const claimLocks = new Map();

wss.on('connection', (ws) => {
    clients.set(ws, "");
    console.log("New client connected!");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe') {
                const chunk_id = data.chunk_id || "";
                clients.set(ws, chunk_id);
                console.log(`Client subscribed to chunk: ${chunk_id}`);
                
                for (let lockData of claimLocks.values()) {
                    ws.send(JSON.stringify(lockData));
                }
            } 
            else if (data.type === 'edit_plot' || data.type === 'claim_plot' || data.type === 'unclaim_plot') {
                if (data.type === 'claim_plot') {
                    claimLocks.set(ws, data);
                } else if (data.type === 'unclaim_plot') {
                    claimLocks.delete(ws);
                }

                for (let [client, sub] of clients.entries()) {
                    if (client === ws) continue;
                    if (client.readyState !== 1) continue;
                    if (sub === "") continue;
                    client.send(JSON.stringify(data));
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
            
            for (let [client, sub] of clients.entries()) {
                if (client.readyState === 1 && sub !== "") {
                    client.send(JSON.stringify(lockData));
                }
            }
            claimLocks.delete(ws);
        }

        clients.delete(ws);
        console.log("Client disconnected.");
    });
});

console.log(`CADPlace WebSocket Server running on port ${port}...`);
