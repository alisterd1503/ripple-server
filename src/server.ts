import express, { Request, Response } from 'express';
import cors from 'cors'
import { Message } from './messageModel';
import jwt, { JwtPayload } from 'jsonwebtoken';
import 'dotenv/config'

const app = express();
const PORT = process.env.PORT || 5002;
const jwtSecret = process.env.JWT_SECRET;

const { pool } = require("./database");
const {
    createUsersTable,
    createChatsTable,
    createChatUsersTable,
    createMessagesTable
} = require('./schema');

// Middleware
app.use(cors());
app.use(express.json());

const initialiseDatabase = async () => {
    await createUsersTable();
    await createChatsTable();
    await createChatUsersTable();
    await createMessagesTable();
};

initialiseDatabase().then(() => {
    console.log("Database tables initialised");
}).catch(err => {
    console.error("Error initialising database tables", err);
});

app.get('/api/getProfile', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });
    
    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const query = `
            SELECT bio, avatar, created_at FROM users WHERE id = $1
        `;

        const result = await pool.query(query, [currentUserId]);
        const data = result.rows[0];
        
        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});


// Retrieves all the users the current user is not chatting with
app.get('/api/getUsers', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });
    
    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const query = `
            SELECT id AS "userId", username 
            FROM users 
            WHERE id != $1
              AND id NOT IN (
                  SELECT user_id 
                  FROM chat_users 
                  WHERE chat_id IN (
                      SELECT chat_id 
                      FROM chat_users 
                      WHERE user_id = $1
                  )
              );
        `;

        const result = await pool.query(query, [currentUserId]);
        const data = result.rows;

        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// Retrieves all the users to check for duplicate names during registeration
app.get('/api/getAllUsers', async (req, res) => {
    try {
        const result = await pool.query(`SELECT username, id FROM users`);
        const data = result.rows;

        res.status(200).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

app.post('/api/startChat', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { userId, username } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        const chatResult = await pool.query(`
            INSERT INTO chats (title, is_group_chat)
            VALUES ($1, false)
            RETURNING id
        `, [username]);

        const chatId = chatResult.rows[0].id;

        const insertResult = await pool.query(`
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ($1, $2), ($1, $3)
        `, [chatId, currentUserId, userId]);

        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        console.error('Error starting chat:', err);
        res.status(500).json({ error: 'Error starting chat' });
    }
});

app.get('/api/getMessages', async (req, res) => {
    const { chatId } = req.query;

    try {
        const data = await pool.query(`
            SELECT m.message, m.created_at, m.user_id, u.username
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.chat_id = $1
            ORDER BY m.created_at ASC
        `, [chatId]);

        const messages: Message[] = data.rows.map((row: { user_id: any; username: any; message: any; created_at: any; }) => ({
            userId: row.user_id,
            username: row.username,
            message: row.message,
            createdAt: row.created_at
        }));

        res.status(200).json(messages);
    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

app.post('/api/postMessage', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId, message } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        const insertResult = await pool.query(
            'INSERT INTO messages (chat_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
            [chatId, currentUserId, message]
        );
        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        console.error('Error posting message:', err);
        res.status(500).json({ error: 'Error posting message' });
    }
});

app.post('/api/register', async (req, res): Promise<any> => {
    const body = {
        username: req.body.username,
        password: req.body.password,
    };

    try {
        // if username already exists, return
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [body.username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const insertResult = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
            [body.username, body.password]
        );
        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ error: 'Error registering user' });
    }
});

app.post('/api/login', async (req, res): Promise<any> => {

    const body = {
        username: req.body.username,
        password: req.body.password,
    };

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [body.username]);
        const user = result.rows[0];
        
        if (!user) return res.status(401).json({ message: 'Username not found' });
        if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' })

        if (body.password === user.password) {
            const token = jwt.sign(
                { userId: user.id, username: user.username, role: user.role },
                jwtSecret,
                { expiresIn: '1h' }
              );
            res.status(200).json({ token });
        } else {
            res.status(401).json({ message: 'Invalid password.' });
        }
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Retrieves all the users the current user is chatting too
app.get('/api/getUserChat', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const userId = decoded.userId;
        
        if (!userId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }
        
        // Query for chat data including last message and last message time
        const data = await pool.query(`
            SELECT 
                cu.chat_id, 
                u.id AS user_id, 
                u.username,
                m.message AS lastMessage,
                m.created_at AS lastMessageTime
            FROM chat_users cu
            JOIN users u ON cu.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT message, created_at 
                FROM messages 
                WHERE chat_id = cu.chat_id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) m ON true
            WHERE cu.chat_id IN (
                SELECT chat_id
                FROM chat_users
                WHERE user_id = $1
            ) AND cu.user_id != $1
        `, [userId]);

        // Format response to include last message and timestamp
        const usersWithChats = data.rows.map((row: any) => ({
            chatId: row.chat_id,
            userId: row.user_id,
            username: row.username,
            lastMessage: row.lastmessage,
            lastMessageTime: row.lastmessagetime
        }));
        
        res.status(200).json(usersWithChats);
    } catch (err) {
        console.error('Error during token verification or database query:', err);

        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        res.status(500).json({ message: 'Error fetching users chats' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
