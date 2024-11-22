const { pool } = require('../../database');

interface ContactModel {
    chatId: number;
    title: string | null;
    username: string | null;
    userId: number | null;
    groupAvatar: string | null;
    avatar: string | null;
    isGroupChat: boolean;
    lastMessage: string | null;
    isImage: boolean;
    lastMessageTime: string | null;
    lastMessageSender: string | null;
    members: string[] | null;
    isFavourite: boolean;
    unReadMessages: number;
    readLastMessage: boolean
}

// Fetch contacts for a given user
export const getContactList = async (userId: number): Promise<ContactModel[]> => {

    const contacts: ContactModel[] = [];
    
    try {
        // Fetch all chats the user is part of
        const chatResults = await pool.query(
            `SELECT chat_id, is_favourite FROM chat_users WHERE user_id = $1`,
            [userId]
        );

        const chats = chatResults.rows;

        for (const chat of chats) {
            const chatId = chat.chat_id;
            const isFavourite = chat.is_favourite;

            // Get the last message for the chat
            const messageResult = await pool.query(
                `SELECT
                    id,
                    message, 
                    is_image, 
                    created_at AS last_message_time, 
                    user_id AS last_message_user_id
                 FROM messages 
                 WHERE chat_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [chatId]
            );

            const lastMessage = messageResult.rows[0];
            const lastMessageData = lastMessage
                ? {
                      lastMessage: lastMessage.message,
                      isImage: lastMessage.is_image,
                      lastMessageTime: lastMessage.last_message_time,
                      lastMessageSender: null,
                  }
                : { lastMessage: null, isImage: false, lastMessageTime: null, lastMessageSender: null };

            // Fetch username of last message sender if a message exists
            if (lastMessage) {
                const senderResult = await pool.query(
                    `SELECT username FROM users WHERE id = $1`,
                    [lastMessage.last_message_user_id]
                );
                lastMessageData.lastMessageSender = senderResult.rows[0]?.username || null;
            }

            // Fetch chat details
            const chatDetails = await pool.query(
                `SELECT * FROM chats WHERE id = $1`,
                [chatId]
            );
            const chatData = chatDetails.rows[0];

            const unreadMessages = await pool.query(
                `SELECT COUNT(*) AS unread_count
                FROM messages m
                LEFT JOIN read_receipts rr 
                    ON m.id = rr.message_id AND rr.user_id = $1
                WHERE m.chat_id = $2 AND rr.user_id IS NULL;`,
                [userId, chatId]
            )

            const unreadCount = unreadMessages.rows[0]?.unread_count;

            const readStatusResult = await pool.query(
                `SELECT EXISTS (
                    SELECT 1 
                    FROM read_receipts 
                    WHERE message_id = $1 AND user_id = $2
                ) AS has_read;`,
                [lastMessage.id, userId]
            );
            
            // Extract the read status
            const hasRead = readStatusResult.rows[0]?.has_read;

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
                    lastMessage: lastMessageData.lastMessage,
                    isImage: lastMessageData.isImage,
                    lastMessageTime: lastMessageData.lastMessageTime,
                    lastMessageSender: lastMessageData.lastMessageSender,
                    members: members,
                    isFavourite: isFavourite,
                    unReadMessages: unreadCount,
                    readLastMessage: hasRead,
                });
            } else {
                // For private chats, fetch the other user's details
                const otherUserResult = await pool.query(
                    `SELECT u.id AS user_id, u.username, u.avatar
                     FROM chat_users cu
                     JOIN users u ON cu.user_id = u.id
                     WHERE cu.chat_id = $1 AND u.id != $2`,
                    [chatId, userId]
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
                    lastMessage: lastMessageData.lastMessage,
                    isImage: lastMessageData.isImage,
                    lastMessageTime: lastMessageData.lastMessageTime,
                    lastMessageSender: lastMessageData.lastMessageSender,
                    members: null,
                    isFavourite: isFavourite,
                    unReadMessages: unreadCount,
                    readLastMessage: hasRead
                });
            }
        }
        return contacts;
    } catch (error) {
        console.error('Error fetching contact list:', error);
        throw new Error('Could not fetch contact list');
    }
}
