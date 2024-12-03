import WebSocket, { Server as WebSocketServer } from 'ws';
import { verifyToken } from '../../services/jwtService';
const { pool } = require('../../database');

export const handleOnlineStatus = (wss: WebSocketServer): void => {
    const userConnections = new Map<number, WebSocket>();
    wss.on('connection', (ws: WebSocket) => {

        ws.on('message', async (message: string) => {
            try {
                const { token, action }: { token: string; action: string } = JSON.parse(message);

                const userId = verifyToken(token);

                if (!userId) {
                    ws.close();
                    return;
                }

                if (action === 'setOnline') {
                    userConnections.set(userId, ws); 
                    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [userId]);
                } else if (action === 'setOffline') {
                    userConnections.delete(userId);
                    await pool.query('UPDATE users SET is_online = false WHERE id = $1', [userId]);
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });

        ws.on('close', async () => {
            const disconnectedUserId = [...userConnections.entries()]
                .find(([, socket]) => socket === ws)?.[0];

            if (disconnectedUserId) {
                userConnections.delete(disconnectedUserId);
                await pool.query('UPDATE users SET is_online = false WHERE id = $1', [disconnectedUserId]);
            }
        });
    });

    console.log('WebSocket server is running');
};
