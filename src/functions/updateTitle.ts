const { pool } = require("../database");

export const updateTitle = async (chatId: number, title: string): Promise<{ success: boolean; message: string }> => {
    try {
        // Update the group title in the database
        await pool.query(
            `
            UPDATE chats 
            SET title = $1 
            WHERE id = $2
            `,
            [title, chatId]
        );

        return { success: true, message: "Title updated successfully" };
    } catch (err) {
        console.error("Error updating title:", err);
        return { success: false, message: "Error updating title" };
    }
};
