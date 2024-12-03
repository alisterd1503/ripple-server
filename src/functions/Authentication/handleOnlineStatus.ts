import WebSocket, { Server as WebSocketServer } from 'ws';
import { verifyToken } from '../../services/jwtService';
const { pool } = require('../../database');

export const handleOnlineStatus = (wss: WebSocketServer): void => {
    const userConnections = new Map<number, WebSocket>();
    console.log(userConnections)
    wss.on('connection', (ws: WebSocket) => {
        console.log('New client connected');
        console.log(userConnections)

        ws.on('message', async (message: string) => {
            try {
                const { token, action }: { token: string; action: string } = JSON.parse(message);

                const userId = verifyToken(token); // Verify the token to identify the user

                if (!userId) {
                    ws.close(); // Close connection for invalid tokens
                    return;
                }

                if (action === 'setOnline') {
                    userConnections.set(userId, ws); // Track WebSocket for this user
                    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [userId]);
                    console.log(`User ${userId} is now online`);
                } else if (action === 'setOffline') {
                    userConnections.delete(userId); // Remove WebSocket for this user
                    await pool.query('UPDATE users SET is_online = false WHERE id = $1', [userId]);
                    console.log(`User ${userId} is now offline`);
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });

        ws.on('close', async () => {
            // Identify the user based on WebSocket
            const disconnectedUserId = [...userConnections.entries()]
                .find(([, socket]) => socket === ws)?.[0];

            if (disconnectedUserId) {
                userConnections.delete(disconnectedUserId); // Remove WebSocket for this user
                await pool.query('UPDATE users SET is_online = false WHERE id = $1', [disconnectedUserId]);
                console.log(`User ${disconnectedUserId} went offline`);
            }
        });
    });

    console.log('WebSocket server is running');
};
