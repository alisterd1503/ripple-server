const { pool } = require("../database");

export const leaveGroup = async (chatId: number, userId: number): Promise<{ success: boolean; message: string }> => {
    try {
        // Remove the user from the chat_users table
        await pool.query('DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2;', [chatId, userId]);

        return { success: true, message: 'Left group successfully' };
    } catch (err) {
        console.error('Error leaving group:', err);
        return { success: false, message: 'Error leaving group' };
    }
};