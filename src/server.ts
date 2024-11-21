import express from 'express';
import cors from 'cors'
import jwt, { JwtPayload } from 'jsonwebtoken';
import 'dotenv/config'
import multer from 'multer';
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
import { verifyToken } from './services/jwtService';
import { removeFriend } from './functions/removeFriend';
import { getProfile } from './functions/getProfile';
import { changePassword } from './functions/changePassword';
import { updateBio } from './functions/updateBio';
import { updateUsername } from './functions/updateUsername';
import { deletePhoto } from './functions/deletePhoto';
import { uploadPhoto } from './functions/uploadPhoto';
import { deleteAccount } from './functions/deleteAccount';
import { startGroupChat } from './functions/startGroupChat';
import { updateTitle } from './functions/updateTitle';
import { updateDescription } from './functions/updateDescription';
import { deleteGroupPhoto } from './functions/deleteGroupPhoto';
import { uploadGroupPhoto } from './functions/uploadGroupPhoto';
import { leaveGroup } from './functions/leaveGroup';

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
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    try {
        const data = await getUsers(currentUserId);
        res.status(200).json(data);
    } catch (err) {
        console.error('Error getting users:', err);
        res.status(500).json({ error: 'Error getting users' });
    }
});

/** Find & Add User **/

app.post('/api/startChat', async (req, res): Promise<any> => {

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { userId } = req.body;

    try {
        const result = await startChat(currentUserId, userId);
        res.status(201).json(result);
    } catch (err) {
        console.error("Error starting chat:", err);
        res.status(500).json({ error: "Error starting chat" });
    }
});

/** Message **/

app.get('/api/getMessages', async (req, res): Promise<any> => {

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { chatId } = req.query;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const messages = await getMessages(currentUserId, Number(chatId));
        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ error: "Error fetching messages" });
    }
});

app.post('/api/postMessage', upload.single('image'), async (req, res): Promise<any> => {

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { chatId, message } = req.body;

    try {
        const result = await postMessage(currentUserId, Number(chatId), message, req.file);
        res.status(201).json(result);
    } catch (err) {
        console.error('Error posting message:', err);
        res.status(500).json({ error: 'Error posting message' });
    }
});

app.get('/api/getUsernameAvatar', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    try {
        const data = await getUsernameAvatar(currentUserId);
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

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { userId } = req.query;

    try {
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

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { chatId } = req.query;

    try {
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
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const currentUserId = verifyToken(token)
    if (!currentUserId) throw new Error('Invalid token');

    const { chatId, userId, isFavourite } = req.body;

    try {
        const response = await favouriteChat({isFavourite: isFavourite, currentUserId: currentUserId, chatId: chatId, userId: userId});

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
    const { userId } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token to extract the current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `removeFriend` function
        const response = await removeFriend(currentUserId, userId);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(404).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error removing friend:", err);
        res.status(500).json({ error: "Error removing friend" });
    }
});

/** SETTINGS **/

// Route to get current users profile for settings page
app.get('/api/getProfile', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        const response = await getProfile(currentUserId);
        res.status(200).json(response);
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).json({ error: "Error fetching profile" });
    }
});

// Route to update password

app.post('/api/changePassword', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    const body = {
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        confirmPassword: req.body.confirmPassword,
    };

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        const response = await changePassword(
            currentUserId,
            body.currentPassword,
            body.newPassword,
            body.confirmPassword
        );

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error changing password:", err);
        res.status(500).json({ error: "Error changing password" });
    }
});

// Route to update bio
app.post('/api/updateBio', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { bio } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token and extract current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `updateBio` function
        const response = await updateBio(currentUserId, bio);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error updating bio:", err);
        res.status(500).json({ error: "Error updating bio" });
    }
});

// Route to update username
app.post('/api/updateUsername', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { username } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token and extract the current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `updateUsername` function
        const response = await updateUsername(currentUserId, username);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error updating username:", err);
        res.status(500).json({ error: "Error updating username" });
    }
});

// Route to delete profile photo
app.post('/api/deletePhoto', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token and extract the current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `deletePhoto` function
        const response = await deletePhoto(currentUserId);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(500).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error deleting profile photo:", err);
        res.status(500).json({ error: "Error deleting profile photo" });
    }
});

// Route to upload profile photo
app.post('/api/uploadPhoto', upload.single("avatar"), async (req, res): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token and extract the current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Get the uploaded file from the request
        const file = req.file;

        // Call the `uploadPhoto` function
        const response = await uploadPhoto(currentUserId, file);

        if (response.success) {
            res.status(200).json({
                message: response.message,
                avatarPath: response.avatarPath,
            });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (error) {
        console.error("Error uploading photo:", error);
        res.status(500).json({ error: "Error uploading photo" });
    }
});

// Route to delete account
app.post("/api/deleteAccount", async (req, res): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { currentPassword } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        // Verify the token and extract the current user ID
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `deleteAccount` function
        const response = await deleteAccount(currentUserId, currentPassword);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (error) {
        console.error("Error deleting account:", error);
        res.status(500).json({ error: "Error deleting account" });
    }
});

/** GROUP CHAT **/

// Route to start group chat
app.post("/api/startGroupChat", upload.single("avatar"), async (req, res): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Parse users from request body
        const users = req.body.users.map((userStr: string) => {
            try {
                return JSON.parse(userStr);
            } catch (error) {
                console.error("Error parsing user:", error);
                return null;
            }
        }).filter((user: null) => user !== null);

        // Extract optional fields
        const title = req.body.title || null;
        const description = req.body.description || null;
        const avatarPath = req.file ? `/${req.file.path}` : null;

        // Call the `startGroupChat` function
        const response = await startGroupChat(currentUserId, users, title, description, avatarPath);

        if (response.success) {
            res.status(201).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error starting group chat:", err);
        res.status(500).json({ error: "Error starting group chat" });
    }
});

// Route to update group title
app.post("/api/updateTitle", async (req, res): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { chatId, title } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `updateTitle` function
        const response = await updateTitle(Number(chatId), title);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(500).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing updateTitle request:", err);
        res.status(500).json({ error: "Error processing updateTitle request" });
    }
});

// Route to update description
app.post("/api/updateDescription", async (req, res): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { description, chatId } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        // Call the `updateDescription` function
        const response = await updateDescription(Number(chatId), description);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing updateDescription request:", err);
        res.status(500).json({ error: "Error processing updateDescription request" });
    }
});

// Route to delete group photo
app.post('/api/deleteGroupPhoto', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: 'Invalid token' });

        // Call the `deleteGroupPhoto` function
        const response = await deleteGroupPhoto(Number(chatId));

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing deleteGroupPhoto request:", err);
        res.status(500).json({ error: "Error processing deleteGroupPhoto request" });
    }
});

// Route to upload group photo
app.post('/api/uploadGroupPhoto', upload.single('avatar'), async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: 'Invalid token' });

        const file = req.file;

        // Call the `uploadGroupPhoto` function
        const response = await uploadGroupPhoto(Number(chatId), file);

        if (response.success) {
            res.status(200).json({ message: response.message, avatarPath: response.avatarPath });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing uploadGroupPhoto request:", err);
        res.status(500).json({ error: "Error processing uploadGroupPhoto request" });
    }
});

// Route to remove user from group
app.post('/api/leaveGroup', async (req, res): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    const { chatId } = req.body;

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: 'Invalid token' });

        const response = await leaveGroup(Number(chatId), currentUserId);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing leaveGroup request:", err);
        res.status(500).json({ error: "Error processing leaveGroup request" });
    }
});

/** SERVER **/

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
