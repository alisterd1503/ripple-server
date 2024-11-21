const { pool } = require("../database");

export const removeFriend = async (currentUserId: number, userId: number): Promise<{ success: boolean; message: string }> => {
    try {
        // Find the one-to-one chat between the current user and the target user
        const getChatIdQuery = `
            SELECT c.id
            FROM chats c
            JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = $1
            JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = $2
            WHERE c.is_group_chat = false
            LIMIT 1;
        `;
        const chatResult = await pool.query(getChatIdQuery, [currentUserId, userId]);

        if (chatResult.rows.length === 0) {
            return { success: false, message: "No one-to-one chat found between the users" };
        }

        const chatId = chatResult.rows[0].id;

        // Delete the chat
        const deleteChatQuery = `
            DELETE FROM chats
            WHERE id = $1;
        `;
        await pool.query(deleteChatQuery, [chatId]);

        return { success: true, message: "Friend and chat removed successfully" };
    } catch (err) {
        console.error("Error removing friend and chat:", err);
        return { success: false, message: "Error removing friend and chat" };
    }
};
