const { pool } = require('../../database');

interface ChatModel {
    avatar: string | null;
    title: string | null;
    username: string | null;
    userId: number | null;
    groupAvatar: string | null;
    chatId: number;
    isGroupChat: boolean | null;
    members: string[] | null;
}

// Fetch contacts for a given user
export const getChatHeader = async (currentUserId: number, chatId: number): Promise<ChatModel> => {

    const contacts: ChatModel[] = [];
    
    try {
        // Fetch chat details
        const chatDetails = await pool.query(
            `SELECT * FROM chats WHERE id = $1`,
            [chatId]
        );

        const chatData = chatDetails.rows[0];
        
        if (chatData.is_group_chat) {
            // For group chats, fetch all members
            const membersResult = await pool.query(
                `SELECT u.username 
                    FROM chat_users cu
                    JOIN users u ON cu.user_id = u.id
                    WHERE cu.chat_id = $1`,
                [chatId]
            );

            const members = membersResult.rows.map((row: any) => row.username);

            // Construct the contact model for group chat
            contacts.push({
                chatId: chatId,
                title: chatData.title,
                username: null,
                userId: null,
                groupAvatar: chatData.group_avatar,
                avatar: null,
                isGroupChat: true,
                members: members,
            });
        } else {
            // For private chats, fetch the other user's details
            const otherUserResult = await pool.query(
                `SELECT u.id AS user_id, u.username, u.avatar
                    FROM chat_users cu
                    JOIN users u ON cu.user_id = u.id
                    WHERE cu.chat_id = $1 AND u.id != $2`,
                [chatId, currentUserId]
            );

            const otherUser = otherUserResult.rows[0];

            // Construct the contact model for private chat
            contacts.push({
                chatId: chatId,
                title: null,
                username: otherUser.username,
                userId: otherUser.user_id,
                groupAvatar: null,
                avatar: otherUser.avatar,
                isGroupChat: false,
                members: null,
            });
        }
        return contacts[0];
    } catch (error) {
        console.error('Error fetching contact list:', error);
        throw new Error('Could not fetch contact list');
    }
}
