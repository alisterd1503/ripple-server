const { pool } = require('../../database');

export const startGroupChat = async (
    currentUserId: number,
    users: { userId: number; username: string }[],
    title: string | null,
    description: string | null,
    avatarPath: string | null
): Promise<{ success: boolean; message: string }> => {
    try {
        // Collect user IDs and sort them
        const userIds = users.map(user => user.userId);
        userIds.push(currentUserId);
        userIds.sort();

        // Create title and description if not provided
        const usernames = users.map(user => user.username).join(", ");
        const chatTitle = title || usernames;
        const chatDescription = description || "Add a Description...";

        // Validate group members
        if (userIds.length <= 1) {
            return { success: false, message: "Add more members" };
        }

        // Check if a group chat with the exact same set of users already exists
        const existingChatResult = await pool.query(
            `
            SELECT c.id
            FROM chats c
            JOIN chat_users cu ON c.id = cu.chat_id
            WHERE c.is_group_chat = true
            GROUP BY c.id
            HAVING array_agg(cu.user_id ORDER BY cu.user_id) = $1
            `,
            [userIds]
        );

        if (existingChatResult.rows.length > 0) {
            return { success: false, message: "Group chat already exists" };
        }

        // Create a new group chat
        const chatResult = await pool.query(
            `
            INSERT INTO chats (title, description, group_avatar, is_group_chat)
            VALUES ($1, $2, $3, true)
            RETURNING id
            `,
            [chatTitle, chatDescription, avatarPath]
        );

        const chatId = chatResult.rows[0].id;

        // Batch insert members into `chat_users`
        const valuesString = userIds.map((_, index) => `($1, $${index + 2})`).join(", ");
        const values = [chatId, ...userIds];

        await pool.query(
            `
            INSERT INTO chat_users (chat_id, user_id)
            VALUES ${valuesString}
            `,
            values
        );

        return { success: true, message: "Group chat created successfully" };
    } catch (err) {
        console.error("Error starting group chat:", err);
        return { success: false, message: "Error starting group chat" };
    }
};
