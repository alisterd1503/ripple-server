const { pool } = require('../../database');

export const addMembers = async (
    chatId: number,
    users: { userId: number; username: string }[]
): Promise<{ success: boolean; message: string }> => {
    try {
        // Get current members of the group
        const currentMembers = await pool.query(
            `SELECT u.id AS user_id
             FROM chat_users cu
             JOIN users u ON cu.user_id = u.id
             WHERE cu.chat_id = $1`,
            [chatId]
        );

        const currentMemberIds = currentMembers.rows.map((row: { user_id: number; }) => row.user_id);

        // Collect new user IDs and sort the combined list for comparison
        const newUserIds = users.map(user => user.userId);
        const combinedUserIds = [...new Set([...currentMemberIds, ...newUserIds])].sort();

        // Check if a group chat with this exact user set already exists
        const existingChatResult = await pool.query(
            `
            SELECT c.id
            FROM chats c
            JOIN chat_users cu ON c.id = cu.chat_id
            WHERE c.is_group_chat = true
            GROUP BY c.id
            HAVING array_agg(cu.user_id ORDER BY cu.user_id) = $1
            `,
            [combinedUserIds]
        );

        if (existingChatResult.rows.length > 0) {
            return { success: false, message: "Group chat with these members already exists." };
        }

        // Filter to insert only users who are not already in the group
        const newUsersToAdd = newUserIds.filter(userId => !currentMemberIds.includes(userId));
        if (newUsersToAdd.length === 0) {
            return { success: false, message: "No new members to add." };
        }

        // Prepare the values for batch insert
        const valuesString = newUsersToAdd.map((_, index) => `($1, $${index + 2})`).join(", ");
        const values = [chatId, ...newUsersToAdd];

        await pool.query(
            `
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ${valuesString}
            `,
            values
        );

        return { success: true, message: "New members added successfully." };
    } catch (err) {
        console.error("Error adding new members to chat:", err);
        return { success: false, message: "Error adding new members." };
    }
};
