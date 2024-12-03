const { pool } = require('../../database');

export const removeMember = async (
    chatId: number,
    userId: number
): Promise<{ success: boolean; message: string }> => {
    try {
        const result = await pool.query(
            `DELETE FROM chat_users WHERE chat_id = $1 AND user_id = $2;`,
            [chatId, userId]
        );

        if (result.rowCount > 0) {
            return { success: true, message: "User removed successfully." };
        } else {
            return { success: false, message: "User not found in the chat." };
        }
    } catch (err) {
        console.error("Error removing user from chat:", err);
        return { success: false, message: "Error removing user from chat." };
    }
};
