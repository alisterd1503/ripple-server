const { pool } = require("../database");

export const favouriteChat = async (isFavourite: boolean, currentUserId: number, chatId?: number, userId?: number): Promise<{ success: boolean; message: string }> => {
    try {
        if (!chatId && !userId) {
            return { success: false, message: 'Either chatId or userId must be provided' };
        }

        let targetChatId = chatId;

        // If userId is provided, determine the chatId for the one-to-one chat
        if (userId) {
            const oneToOneChatQuery = `
                SELECT c.id AS chat_id
                FROM chats c
                JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = $1
                JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = $2
                WHERE c.is_group_chat = false
                LIMIT 1;
            `;
            const oneToOneChatResult = await pool.query(oneToOneChatQuery, [currentUserId, userId]);

            if (oneToOneChatResult.rows.length === 0) {
                return { success: false, message: 'No one-to-one chat found with the specified user' };
            }

            targetChatId = oneToOneChatResult.rows[0].chat_id;
        }

        // Update the favourite status in the database
        const updateFavouriteQuery = `
            UPDATE chat_users
            SET is_favourite = $1
            WHERE chat_id = $2 AND user_id = $3;
        `;
        await pool.query(updateFavouriteQuery, [isFavourite, targetChatId, currentUserId]);

        return { success: true, message: 'Favourite status updated successfully' };
    } catch (err) {
        console.error('Error updating favourite status:', err);
        return { success: false, message: 'Error updating favourite status' };
    }
};
