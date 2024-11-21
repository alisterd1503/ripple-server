const { pool } = require('../../database');

export const startChat = async (currentUserId: number, userId: number): Promise<{ chatId: number }> => {

    // Check if a chat already exists between the two users
    const existingChatResult = await pool.query(
        `
        SELECT c.id 
        FROM chats c
        JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = $1
        JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = $2
        WHERE c.is_group_chat = false
        `,
        [currentUserId, userId]
    );

    if (existingChatResult.rows.length > 0) {
        return { chatId: existingChatResult.rows[0].id };
    }

    // Chat does not exist, create a new one
    const chatResult = await pool.query(
        `
        INSERT INTO chats (is_group_chat)
        VALUES (false)
        RETURNING id
        `
    );

    const chatId = chatResult.rows[0].id;

    // Add both users to the new chat
    await pool.query(
        `
        INSERT INTO chat_users (chat_id, user_id)
        VALUES ($1, $2), ($1, $3)
        `,
        [chatId, currentUserId, userId]
    );

    return { chatId };
};
