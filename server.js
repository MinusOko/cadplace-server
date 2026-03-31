const { WebSocketServer } = require('ws');

const port = process.env.PORT || 8080; 
const wss = new WebSocketServer({ port: port });

const clients = new Map();

wss.on('connection', (ws) => {
    clients.set(ws, "global");
    console.log("New client connected!");

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe') {
                clients.set(ws, data.chunk_id);
                console.log(`Client subscribed to chunk: ${data.chunk_id}`);
            } 
            else if (data.type === 'edit_plot') {
                const chunkId = getChunkIdFromPlot(data.plot_x, data.plot_y);
                
                for (let [client, sub] of clients.entries()) {
                    if (client !== ws && client.readyState === 1) {
                        // Deliver to the specific chunk OR to the World Map
                        if (sub === chunkId || sub === "global") {
                            client.send(JSON.stringify(data));
                        }
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
