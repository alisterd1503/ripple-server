import express from 'express';
import cors from 'cors'
import jwt, { JwtPayload } from 'jsonwebtoken';
import 'dotenv/config'
import multer from 'multer';
import validatePassword from './validatePassword';
import { formatData } from './formatMessages';

const app = express();
const PORT = process.env.PORT || 5002;
const jwtSecret = process.env.JWT_SECRET;
const upload = multer({ dest: 'uploads/' })
app.use('/uploads', express.static('uploads'));

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

// Route to get current users profile for settings page
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
            SELECT username, bio, avatar, created_at FROM users WHERE id = $1
        `;

        const result = await pool.query(query, [currentUserId]);
        const data = result.rows[0];

        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({ error: 'Error fetching users' });
    }
});

// To retrieve the current users username and avatar
app.get('/api/getUsernameAvatar', async (req, res): Promise<any> => {
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
            SELECT username, avatar FROM users WHERE id = $1
        `;

        const result = await pool.query(query, [currentUserId]);
        const data = result.rows[0];

        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching username:', err);
        res.status(500).json({ error: 'Error fetching username' });
    }
});

// Retrieves all the users and their ids
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

        const result = await pool.query(`SELECT id AS "userId", username FROM users WHERE id != $1;`, [currentUserId]);
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

// Route to start a direct message
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

        // Check if a chat already exists between the two users
        const existingChatResult = await pool.query(`
            SELECT c.id 
            FROM chats c
            JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = $1
            JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = $2
            WHERE c.is_group_chat = false
        `, [currentUserId, userId]);

        if (existingChatResult.rows.length > 0) {
            // Chat already exists, return the existing chat
            return res.status(200).json({ chatId: existingChatResult.rows[0].id });
        }

        // Chat does not exist, create a new one
        const chatResult = await pool.query(`
            INSERT INTO chats (title, is_group_chat)
            VALUES ($1, false)
            RETURNING id
        `, [username]);

        const chatId = chatResult.rows[0].id;

        // Add both users to the new chat
        await pool.query(`
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ($1, $2), ($1, $3)
        `, [chatId, currentUserId, userId]);

        res.status(201).json({ chatId });
    } catch (err) {
        console.error('Error starting chat:', err);
        res.status(500).json({ error: 'Error starting chat' });
    }
});


interface UserModel {
    userId: number;
    username: string;
}

// Route to start group chat
app.post('/api/startGroupChat', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chosenUsers, title }: { chosenUsers: UserModel[]; title: string } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) return res.status(401).json({ message: 'Token is missing user ID' });

        // Collect all user IDs (including current user) for the group
        const userIds = chosenUsers.map(user => user.userId);
        userIds.push(currentUserId);
        userIds.sort();  // Sort to ensure the order matches for comparison

        // Check if a group chat with the exact same set of users already exists
        const existingChatResult = await pool.query(`
            SELECT c.id
            FROM chats c
            JOIN chat_users cu ON c.id = cu.chat_id
            WHERE c.is_group_chat = true
            GROUP BY c.id
            HAVING array_agg(cu.user_id ORDER BY cu.user_id) = $1
        `, [userIds]);

        if (existingChatResult.rows.length > 0) {
            // Group chat already exists, return the existing chat
            return res.status(200).json({ message: 'Group chat already exists', chatId: existingChatResult.rows[0].id });
        }

        // No matching group chat found, create a new one
        const chatResult = await pool.query(`
            INSERT INTO chats (title, is_group_chat)
            VALUES ($1, true)
            RETURNING id
        `, [title]);

        const chatId = chatResult.rows[0].id;

        // Prepare values string for batch insertion into chat_users
        const valuesString = userIds.map((_, index) => `($1, $${index + 2})`).join(", ");
        const values = [chatId, ...userIds];

        await pool.query(`
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ${valuesString}
        `, values);

        res.status(201).json({ message: 'Group chat created successfully', chatId });
    } catch (err) {
        console.error('Error starting chat:', err);
        res.status(500).json({ error: 'Error starting chat' });
    }
});

app.get('/api/getMessages', async (req, res): Promise<any> => {
    const { chatId } = req.query;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {

        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        const data = await pool.query(`
            SELECT m.message, m.created_at, m.user_id, u.username, u.avatar
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.chat_id = $1
            ORDER BY m.created_at ASC
        `, [chatId]);

        const messages = formatData(data.rows, currentUserId)

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
        // Validating Usernames
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [body.username]);
        if (existingUser.rows.length > 0) return res.status(400).json({ message: 'Username already exists' });
        if ((body.username).trim().length < 1) return res.status(400).json({message: 'Username must be at least one character long.'});
        if (/\s/.test(body.username)) return res.status(400).json({ message: 'Username cannot contain spaces.'})

         // Validating Password
         const passwordValidation = validatePassword(body.password);
         if (!passwordValidation.valid) {
             return res.status(400).json({ message: passwordValidation.message });
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
                { expiresIn: '4h' }
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

// Retrieves all the chats the current user is part of, including group chats
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

        // Query to fetch all chats the user is part of, with last message info
        const data = await pool.query(`
            SELECT 
                c.id AS chat_id,
                c.title,
                c.description,
                c.group_avatar,
                c.is_group_chat,
                cu.added_at,
                u.id AS user_id, 
                u.username,
                u.avatar,
                u.bio,
                m.message AS lastMessage,
                m.created_at AS lastMessageTime
            FROM chat_users cu
            JOIN chats c ON cu.chat_id = c.id
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
            ) AND (c.is_group_chat = true OR cu.user_id != $1)
            ORDER BY m.created_at DESC
        `, [userId]);

        // Group chats by chat ID and format the result
        const chats = data.rows.reduce((acc: any, row: any) => {
            const existingChat = acc.find((chat: any) => chat.chatId === row.chat_id);
            
            if (existingChat) {
                // Add user to the participants list if it's a group chat
                if (row.is_group_chat) {
                    existingChat.participants.push({
                        userId: row.user_id,
                        username: row.username,
                        avatar: row.avatar,
                        bio: row.bio,
                    });
                }
            } else {
                // Create a new chat object
                acc.push({
                    chatId: row.chat_id,
                    title: row.title,
                    description: row.description,
                    groupAvatar: row.group_avatar,
                    isGroupChat: row.is_group_chat,
                    lastMessage: row.lastmessage,
                    lastMessageTime: row.lastmessagetime,
                    added_at: row.added_at,
                    participants: [{
                        userId: row.user_id,
                        username: row.username,
                        avatar: row.avatar,
                        bio: row.bio,
                    }],
                });
            }
            return acc;
        }, []);

        res.status(200).json(chats);
    } catch (err) {
        console.error('Error during token verification or database query:', err);

        if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Invalid or expired token' });
        }

        res.status(500).json({ message: 'Error fetching users chats' });
    }
});

// Route to remove a friend
app.post('/api/removeFriend', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const body = {
        chatId: req.body.chatId,
    };

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {

        await pool.query('DELETE FROM chats WHERE id= $1', [body.chatId]);

        res.status(200).json({ message: 'Friend removed successfully' });
    } catch (err) {
        console.error('Error removing friend:', err);
        res.status(500).json({ error: 'Error removing friend' });
    }
});

app.post('/api/leaveGroup', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const body = {
        chatId: req.body.chatId,
    };

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const userId = decoded.userId;

        await pool.query('DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2;', [body.chatId, userId]);

        res.status(200).json({ message: 'Left group successfully' });
    } catch (err) {
        console.error('Error leaving group:', err);
        res.status(500).json({ error: 'Error leaving group' });
    }
});

/** SETTINGS **/

// Route to update password
app.post('/api/changePassword', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const body = {
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        confirmPassword: req.body.confirmPassword,
    };

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        const result = await pool.query('SELECT password FROM users WHERE id = $1', [currentUserId]);
        const storedPassword = result.rows[0]?.password;

        if (body.currentPassword !== storedPassword) {
            return res.status(401).json({ message: 'Invalid current password' });
        }

        if (body.newPassword !== body.confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [body.newPassword, currentUserId]);

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error updating password:', err);
        res.status(500).json({ error: 'Error updating password' });
    }
});

// Route to update bio
app.post('/api/updateBio', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { bio } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        if (bio.length < 1) return res.status(400).json({ message: 'Enter a bio'})
        if (bio.length > 100)return res.status(400).json({ message: 'Bio can only be 100 characters'})

        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        await pool.query(
            'UPDATE users SET bio = $1 WHERE id = $2',
            [bio, currentUserId]
        );
        res.status(200).json({ message: 'Bio updated successfully' });
    } catch (err) {
        console.error('Error updating bio:', err);
        res.status(500).json({ error: 'Error updating bio' });
    }
});

// Route to update username
app.post('/api/updateUsername', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { username } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) return res.status(400).json({ message: 'Username already exists' });
        if ((username).trim().length < 1) return res.status(400).json({message: 'Minimum 1 character'});
        if (/\s/.test(username)) return res.status(400).json({ message: 'Username cannot contain spaces.'})
            
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        await pool.query(
            'UPDATE users SET username = $1 WHERE id = $2',
            [username, currentUserId]
        );

        // Send the new token or a success response
        res.status(200).json({ message: 'Username updated successfully' });
    } catch (err) {
        console.error('Error updating username:', err);
        res.status(500).json({ error: 'Error updating username' });
    }
});

// Route to delete profile photo
app.post('/api/deletePhoto', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ message: 'Token is missing user ID' });
        }

        await pool.query(
            'UPDATE users SET avatar = $1 WHERE id = $2',
            [null, currentUserId]
        );
        res.status(200).json({ message: 'Profile photo deleted successfully' });
    } catch (err) {
        console.error('Error deleting photo:', err);
        res.status(500).json({ error: 'Error deleting photo' });
    }
});

// Route to upload profile photo
app.post('/api/uploadPhoto', upload.single('avatar'), async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Here, we can save the file path or URL in the database
        const avatarPath = `/uploads/${file.filename}`;
        await pool.query(
            'UPDATE users SET avatar = $1 WHERE id = $2',
            [avatarPath, currentUserId]
        );

        // Respond with the path to the saved avatar
        res.json({ message: 'Avatar uploaded successfully', avatarPath });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: 'Error uploading photo' });
    }
});

// Route to delete account
app.post('/api/deleteAccount', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const body = {
        currentPassword: req.body.currentPassword,
    };

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        const result = await pool.query('SELECT password FROM users WHERE id = $1', [currentUserId]);
        const storedPassword = result.rows[0]?.password;

        if (body.currentPassword !== storedPassword) {
            return res.status(401).json({ message: 'Invalid current password' });
        }

        await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [currentUserId]);

        res.status(200).json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ error: 'Error deleting account' });
    }
});


/** GROUP CHAT **/

// Route to update group title
app.post('/api/updateTitle', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId, title } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {

        await pool.query(
            'UPDATE chats SET title = $1 WHERE id = $2',
            [title, chatId]
        );

        // Send the new token or a success response
        res.status(200).json({ message: 'title updated successfully' });
    } catch (err) {
        console.error('Error updating title:', err);
        res.status(500).json({ error: 'Error updating title' });
    }
});

// Route to update description
app.post('/api/updateDescription', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { description, chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        if (description.length < 1) return res.status(400).json({ message: 'Enter a description'})
        if (description.length > 100)return res.status(400).json({ message: 'Description can only be 100 characters'})

        await pool.query(
            'UPDATE chats SET description = $1 WHERE id = $2',
            [description, chatId]
        );
        res.status(200).json({ message: 'Description updated successfully' });
    } catch (err) {
        console.error('Error updating description:', err);
        res.status(500).json({ error: 'Error updating description' });
    }
});

// Route to delete group photo
app.post('/api/deleteGroupPhoto', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {

        await pool.query(
            'UPDATE chats SET group_avatar = $1 WHERE id = $2',
            [null, chatId]
        );
        res.status(200).json({ message: 'Group photo deleted successfully' });
    } catch (err) {
        console.error('Error deleting photo:', err);
        res.status(500).json({ error: 'Error deleting photo' });
    }
});

// Route to upload group photo
app.post('/api/uploadGroupPhoto', upload.single('avatar'), async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const avatarPath = `/uploads/${file.filename}`;

        await pool.query(
            'UPDATE chats SET group_avatar = $1 WHERE id = $2',
            [avatarPath, chatId]
        );

        // Respond with the path to the saved avatar
        res.json({ message: 'Photo uploaded successfully', avatarPath });
    } catch (error) {
        console.error('Error uploading photo:', error);
        res.status(500).json({ error: 'Error uploading photo' });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
function formatMessages(data: any) {
    throw new Error('Function not implemented.');
}

