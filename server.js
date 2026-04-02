const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080; 
const wss = new WebSocketServer({ port: port });

const clients = new Map();

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
            } 
            else if (data.type === 'edit_plot') {
                const chunkId = getChunkIdFromPlot(data.plot_x, data.plot_y);
                
                for (let [client, sub] of clients.entries()) {
                    if (client === ws) continue;
                    if (client.readyState !== 1) continue;
                    if (sub === "") continue;
                    if (sub === chunkId) {
                        client.send(JSON.stringify(data));
                    }
                }
            }
        } catch (e) {
            console.error("Malformed payload received:", e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log("Client disconnected.");
    });
});

function getChunkIdFromPlot(x, y) {
    return `${Math.floor(x/8)}_${Math.floor(y/8)}`;
}

console.log(`CADPlace WebSocket Server running on port ${port}...`);
