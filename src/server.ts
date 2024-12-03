import express from 'express';
import 'dotenv/config'
import multer from 'multer';

import { loginUser } from './functions/Authentication/loginUser';
import { registerUser } from './functions/Authentication/registerUser';
import { getMessages } from './functions/Chat/getMessages';
import { getUsernameAvatar } from './functions/Chat/getUsernameAvatar';
import { getUsers } from './functions/Contacts/getUsers';
import { startChat } from './functions/Contacts/startChat';
import { startGroupChat } from './functions/Contacts/startGroupChat';
import { deleteGroupPhoto } from './functions/GroupChatSettings/deleteGroupPhoto';
import { updateDescription } from './functions/GroupChatSettings/updateDescription';
import { updateTitle } from './functions/GroupChatSettings/updateTitle';
import { uploadGroupPhoto } from './functions/GroupChatSettings/uploadGroupPhoto';
import { favouriteChat } from './functions/Profile/favouriteChat';
import { getGroupProfile } from './functions/Profile/GroupProfile/getGroupProfile';
import { leaveGroup } from './functions/Profile/GroupProfile/leaveGroup';
import { getUserProfile } from './functions/Profile/UserProfile/getUserProfile';
import { removeFriend } from './functions/Profile/UserProfile/removeFriend';
import { changePassword } from './functions/Settings/changePassword';
import { deleteAccount } from './functions/Settings/deleteAccount';
import { deletePhoto } from './functions/Settings/deletePhoto';
import { getProfile } from './functions/Settings/getSettingsProfile';
import { updateBio } from './functions/Settings/updateBio';
import { updateUsername } from './functions/Settings/updateUsername';
import { uploadPhoto } from './functions/Settings/uploadPhoto';
import { verifyToken } from './services/jwtService';
import { postMessage } from './functions/Chat/postMessage';
import { getContactList } from './functions/Contacts/getContactList';
import { getChatHeader } from './functions/Chat/getChatHeader';
import { logoutUser } from './functions/Authentication/logoutUser';
import { addMembers } from './functions/GroupChatSettings/addMembers';
import { removeMember } from './functions/GroupChatSettings/removeMember';

const app = express();
const PORT = parseInt(process.env.PORT as string, 10) || 5002;
const upload = multer({ dest: 'uploads/' })
const cors = require('cors')
const http = require('http');
const { Server: WebSocketServer } = require('ws');

app.use('/uploads', express.static('uploads'));
const { handleOnlineStatus } = require('./functions/Authentication/handleOnlineStatus');


const {
    createUsersTable,
    createChatsTable,
    createChatUsersTable,
    createMessagesTable,
    createReadReciepts
} = require('./schema');

// Middleware
app.use(cors());
app.use(express.json());

const initialiseDatabase = async () => {
    await createUsersTable();
    await createChatsTable();
    await createChatUsersTable();
    await createMessagesTable();
    await createReadReciepts();
};

initialiseDatabase().then(() => {
    console.log("Database tables initialised");
}).catch(err => {
    console.error("Error initialising database tables", err);
});

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });
handleOnlineStatus(wss);

app.get('/api/getUsers', async (req: any, res: any): Promise<any> => {
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

app.post('/api/startChat', async (req: any, res: any): Promise<any> => {

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

app.get('/api/getChatHeader', async (req: any, res: any): Promise<any> => {
    const { chatId } = req.query;
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        //Verify the token and get the userId
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: 'Invalid token' });

        // Get the contact list using the refactored function
        const chats = await getChatHeader(currentUserId,chatId);
        res.status(200).json(chats);
    } catch (err) {
        console.error('Error fetching chat header:', err);
        res.status(500).json({ message: 'Error fetching chat header' });
    }
});

app.get('/api/getMessages', async (req: any, res: any): Promise<any> => {

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

app.post('/api/postMessage', upload.single('image'), async (req: any, res: any): Promise<any> => {

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

app.get('/api/getUsernameAvatar', async (req: any, res: any): Promise<any> => {
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
app.get('/api/getContactList', async (req: any, res: any): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        // Verify the token and get the userId
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: 'Invalid token' });

        // Get the contact list using the refactored function
        const chats = await getContactList(currentUserId);
        res.status(200).json(chats);
    } catch (err) {
        console.error('Error fetching contact list:', err);
        res.status(500).json({ message: 'Error fetching users chats' });
    }
});

/** AUTHENTICATION **/

// Route to register new user
app.post('/api/registerUser', async (req: any, res: any): Promise<any> => {
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
app.post('/api/loginUser', async (req: any, res: any): Promise<any> => {
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

// Route to logout user
app.get('/api/logoutUser', async (req: any, res: any): Promise<any> => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    let currentUserId;
    try {
        currentUserId = verifyToken(token); // Assuming verifyToken throws if invalid
    } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ message: 'Invalid or expired token' });
    }

    try {
        const data = await logoutUser(currentUserId);
        res.status(200).json(data);
    } catch (err) {
        console.error('Error logging out user:', err);
        res.status(500).json({ error: 'Error logging out user' });
    }
});

/** Profile **/

app.get('/api/getUserProfile', async (req: any, res: any): Promise<any> => {

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

app.get('/api/getGroupProfile', async (req: any, res: any): Promise<any> => {

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

app.post('/api/favouriteChat', async (req: any, res: any): Promise<any> => {
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
app.post('/api/removeFriend', async (req: any, res: any): Promise<any> => {
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
app.get('/api/getProfile', async (req: any, res: any): Promise<any> => {
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

app.post('/api/changePassword', async (req: any, res: any): Promise<any> => {
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
app.post('/api/updateBio', async (req: any, res: any): Promise<any> => {
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
app.post('/api/updateUsername', async (req: any, res: any): Promise<any> => {
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
app.post('/api/deletePhoto', async (req: any, res: any): Promise<any> => {
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
app.post('/api/uploadPhoto', upload.single("avatar"), async (req: any, res: any): Promise<any> => {
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
app.post("/api/deleteAccount", async (req: any, res: any): Promise<any> => {
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
app.post("/api/startGroupChat", upload.single("avatar"), async (req: any, res: any): Promise<any> => {
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
app.post("/api/updateTitle", async (req: any, res: any): Promise<any> => {
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
app.post("/api/updateDescription", async (req: any, res: any): Promise<any> => {
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
app.post('/api/deleteGroupPhoto', async (req: any, res: any): Promise<any> => {
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
app.post('/api/uploadGroupPhoto', upload.single('avatar'), async (req: any, res: any): Promise<any> => {
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

app.post("/api/addMembers", async (req: any, res: any): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { users, chatId } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        const response = await addMembers(Number(chatId), users);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing AddUser request:", err);
        res.status(500).json({ error: "Error processing AddUser request" });
    }
});

app.post("/api/removeMember", async (req: any, res: any): Promise<any> => {
    const token = req.headers["authorization"]?.split(" ")[1];
    const { userId, chatId } = req.body;

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const currentUserId = verifyToken(token);
        if (!currentUserId) return res.status(401).json({ message: "Invalid token" });

        const response = await removeMember(Number(chatId), userId);

        if (response.success) {
            res.status(200).json({ message: response.message });
        } else {
            res.status(400).json({ message: response.message });
        }
    } catch (err) {
        console.error("Error processing AddUser request:", err);
        res.status(500).json({ error: "Error processing AddUser request" });
    }
});

// Route to remove user from group
app.post('/api/leaveGroup', async (req: any, res: any): Promise<any> => {
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
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
function RemoveUser(arg0: number, userId: any) {
    throw new Error('Function not implemented.');
}

