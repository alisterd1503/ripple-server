import express from 'express';
import cors from 'cors'
import jwt, { JwtPayload } from 'jsonwebtoken';
import 'dotenv/config'
import multer from 'multer';
import { UserProfile } from './models/UserProfileModel';
import { GroupProfile } from './models/GroupProfileModel';
import { getUsers } from './functions/getUsers';
import { startChat } from './functions/startChat';
import { getMessages } from './functions/getMessages';
import { postMessage } from './functions/postMessage';
import { getUsernameAvatar } from './functions/getUsernameAvatar';
import { registerUser } from './functions/registerUser';
import { loginUser } from './functions/loginUser';
import { getUserProfile } from './functions/getUserProfile';
import { getGroupProfile } from './functions/getGroupProfile';
import { favouriteChat } from './functions/favouriteChat';

const app = express();
const PORT = parseInt(process.env.PORT as string, 10) || 5002;
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

app.get('/api/getUsers', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const data = await getUsers(token);
        res.status(200).json(data);
    } catch (err) {
        console.error('Error getting users:', err);
        res.status(500).json({ error: 'Error getting users' });
    }
});

/** Find & Add User **/

app.post('/api/startChat', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { userId } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const result = await startChat(token, userId);
        res.status(201).json(result);
    } catch (err) {
        console.error("Error starting chat:", err);
        res.status(500).json({ error: "Error starting chat" });
    }
});

/** Message **/

app.get('/api/getMessages', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.query;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const messages = await getMessages(token, Number(chatId));
        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Error fetching messages" });
    }
});

app.post('/api/postMessage', upload.single('image'), async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId, message } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const result = await postMessage(token, Number(chatId), message, req.file);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error posting message:', err);
        res.status(500).json({ error: 'Error posting message' });
    }
});

app.get('/api/getUsernameAvatar', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const data = await getUsernameAvatar(token);
        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching username:', err);
        res.status(500).json({ error: 'Error fetching username' });
    }
});

/** Contacts **/

// Retrieves all the chats the current user is part of, including group chats
app.get('/api/getContactList', async (req, res): Promise<any> => {
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
                cu.is_favourite,
                u.id AS user_id,
                u.username,
                u.avatar,
                u.bio,
                m.message AS lastMessage,
                m.created_at AS lastMessageTime,
                m_sender.username AS lastMessageSender,
                m.is_image AS isImage
            FROM chat_users cu
            JOIN chats c ON cu.chat_id = c.id
            JOIN users u ON cu.user_id = u.id
            LEFT JOIN LATERAL (
                SELECT 
                    message,
                    is_image,
                    created_at, 
                    user_id 
                FROM messages 
                WHERE chat_id = cu.chat_id 
                ORDER BY created_at DESC 
                LIMIT 1
            ) m ON true
            LEFT JOIN users m_sender ON m.user_id = m_sender.id
            WHERE cu.chat_id IN (
                SELECT chat_id
                FROM chat_users
                WHERE user_id = $1
            ) AND (c.is_group_chat = true OR cu.user_id != $1)
            ORDER BY m.created_at DESC;
        `, [userId]);

        // Group chats by chat ID and format the result
        const chats = data.rows.reduce((acc: any, row: any) => {
            const existingChat = acc.find((chat: any) => chat.chatId === row.chat_id);

            if (existingChat) {
                if (row.is_group_chat) {
                    existingChat.members.push(row.username);
                }
            } else {
                const isGroupChat = row.is_group_chat;

                acc.push({
                    chatId: row.chat_id,
                    title: isGroupChat ? row.title : null,
                    username: !isGroupChat ? row.username : null,
                    userId: !isGroupChat ? row.user_id : null,
                    groupAvatar: isGroupChat ? row.group_avatar : null,
                    avatar: !isGroupChat ? row.avatar : null,
                    isGroupChat: isGroupChat,
                    lastMessage: row.lastmessage,
                    isImage: row.isimage,
                    lastMessageTime: row.lastmessagetime,
                    lastMessageSender: row.lastmessagesender,
                    members: isGroupChat ? [row.username] : null,
                    isFavourite: row.is_favourite
                });
            }
            return acc;
        }, []);

        chats.forEach((chat: any) => {
            if (chat.isGroupChat && chat.members) {
                chat.members = [...new Set(chat.members)];
            }
        });

        res.status(200).json(chats);
    } catch (err) {
        console.error('Error during token verification or database query:', err);
        res.status(500).json({ message: 'Error fetching users chats' });
    }
});

/** AUTHENTICATION **/

// Route to register new user
app.post('/api/registerUser', async (req, res): Promise<any> => {
    const body = {
        username: req.body.username,
        password: req.body.password,
    };

    try {
        const response = await registerUser(body);

        if (response.success) {
            res.status(201).json({ message: response.message });
        } else {
            res.status(400).json({ success: false, message: response.message });
        }
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ success: false, message: 'Error registering user' });
    }
});

// Route to login user
app.post('/api/loginUser', async (req, res): Promise<any> => {
    const body = {
        username: req.body.username,
        password: req.body.password,
    };

    try {
        const response = await loginUser(body);

        if (response.success) {
            res.status(200).json({ success: true, message: response.message, token: response.token });
        } else {
            res.status(401).json({ success: false, message: response.message });
        }
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ success: false, message: 'Error logging in' });
    }
});

/** Profile **/

app.get('/api/getUserProfile', async (req, res): Promise<any> => {
    const { userId } = req.query;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ success: false, message: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Token is missing user ID' });
        }

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId parameter' });
        }

        const response = await getUserProfile(currentUserId, parseInt(userId as string));

        if (response.success) {
            res.status(200).json(response.data);
        } else {
            res.status(404).json({success: false, message: response.message});
        }
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching user profile',
        });
    }
});

app.get('/api/getGroupProfile', async (req, res): Promise<any> => {
    const { chatId } = req.query;
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ success: false, message: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Token is missing user ID' });
        }

        if (!chatId) {
            return res.status(400).json({ success: false, message: 'Missing chatId parameter' });
        }

        const response = await getGroupProfile(currentUserId, parseInt(chatId as string));

        if (response.success) {
            res.status(200).json(response.data);
        } else {
            res.status(404).json({ success: false, message: response.message });
        }
    } catch (err) {
        console.error('Error fetching group profile:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching group profile',
        });
    }
});

app.post('/api/favouriteChat', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId, userId, isFavourite } = req.body;

    if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ success: false, message: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Token is missing user ID' });
        }

        const response = await favouriteChat(currentUserId, chatId, userId, isFavourite);

        if (response.success) {
            res.status(200).json({ success: true, message: response.message });
        } else {
            res.status(400).json({ success: false, message: response.message });
        }
    } catch (err) {
        console.error('Error handling favouriteChat request:', err);
        res.status(500).json({
            success: false,
            message: 'Error handling favouriteChat request',
        });
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

/** SETTINGS **/

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

// Route to start group chat
app.post('/api/startGroupChat', upload.single('avatar'), async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });
    if (!jwtSecret) return res.status(500).json({ error: 'JWT secret not found' });

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) return res.status(401).json({ message: 'Token is missing user ID' });

        const users = req.body.users.map((userStr: string) => {
            try {
                return JSON.parse(userStr);
            } catch (error) {
                console.error('Error parsing user:', error);
                return null;
            }
        }).filter((user: null) => user !== null);

        const userIds = users.map((user: {userId: number, username: string}) => user.userId);
        userIds.push(currentUserId);
        userIds.sort();

        const usernames = users.map((user: { userId: number, username: string }) => user.username).join(', ');

        const title = req.body.title ? req.body.title : usernames;
        const description = req.body.description ? req.body.description : 'Add a Description...';

        if (userIds.length <= 1) return res.status(400).json({ message: 'Add more members' });

        // Check if a group chat with the exact same set of users already exists
        const existingChatResult = await pool.query(`
            SELECT c.id
            FROM chats c
            JOIN chat_users cu ON c.id = cu.chat_id
            WHERE c.is_group_chat = true
            GROUP BY c.id
            HAVING array_agg(cu.user_id ORDER BY cu.user_id) = $1
        `, [userIds]);

        if (existingChatResult.rows.length > 0) return res.status(400).json({ message: 'Group chat already exists' });

        const avatarPath = req.file ? `/${req.file.path}` : null

        // No matching group chat found, create a new one
        const chatResult = await pool.query(`
            INSERT INTO chats (title, description, group_avatar, is_group_chat)
            VALUES ($1, $2, $3, true)
            RETURNING id
        `, [title, description, avatarPath]);

        const chatId = chatResult.rows[0].id;

        // Prepare values string for batch insertion into chat_users
        const valuesString = userIds.map((_: any, index: number) => `($1, $${index + 2})`).join(", ");
        const values = [chatId, ...userIds];

        await pool.query(`
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ${valuesString}
        `, values);

        res.status(201).json({ message: 'Group chat created successfully' });
    } catch (err) {
        console.error('Error starting chat:', err);
        res.status(500).json({ error: 'Error starting chat' });
    }
});

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

// Route to remove user from group
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

/** SERVER **/

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
