import express, { Request, Response } from 'express';
import cors from 'cors'
import { Message } from './messageModel';
import jwt, { JwtPayload } from 'jsonwebtoken';

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

app.get('/api/getUsers', async (req, res) => {
    try {
        const result = await pool.query(`SELECT username, id FROM users`);
        const data = result.rows;

        res.status(200).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

app.post('/api/startChat', async (req, res) => {
    const { currentUserId, recipientUserId, recipientUsername } = req.body;
    try {
        const chatResult = await pool.query(`
            INSERT INTO chats (title, is_group_chat)
            VALUES ($1, false)
            RETURNING id
        `, [recipientUsername]);

        const chatId = chatResult.rows[0].id;

        const insertResult = await pool.query(`
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ($1, $2), ($1, $3)
        `, [chatId, currentUserId, recipientUserId]);

        // 3. Respond with the new chat ID
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
    const { chat_id, user_id, message } = req.body;
    try {
        const insertResult = await pool.query(
            'INSERT INTO messages (chat_id, user_id, message) VALUES ($1, $2, $3) RETURNING *',
            [chat_id, user_id, message]
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
        if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });
    

        // Check if the provided password matches the stored password
        if (body.password === user.password) {
            const token = jwt.sign(
                { userId: user.id, username: user.username },
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

app.get('/api/getUserChat', async (req, res) => {
    const { userId } = req.query;
    try {
        const data = await pool.query(`
            SELECT cu.chat_id, u.id AS user_id, u.username
            FROM chat_users cu
            JOIN users u ON cu.user_id = u.id
            WHERE cu.chat_id IN (
                SELECT chat_id
                FROM chat_users
                WHERE user_id = $1
            ) AND cu.user_id != $1
        `, [userId]);

        const usersWithChats = data.rows.map((row: any) => ({
            chatId: row.chat_id,
            userId: row.user_id,
            username: row.username
        }));
        res.status(200).json(usersWithChats);
    } catch (err) {
        console.error('Error fetching user chats:', err);
        res.status(500).json({ error: 'Error fetching user chats' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
