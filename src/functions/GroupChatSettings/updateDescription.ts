const { pool } = require('../../database');

export const updateDescription = async (chatId: number, description: string): Promise<{ success: boolean; message: string }> => {
    try {
        if (description.length < 1) {
            return { success: false, message: "Enter a description" };
        }

        if (description.length > 100) {
            return { success: false, message: "Description can only be 100 characters" };
        }

        // Update the group chat description in the database
        await pool.query(
            `
            UPDATE chats
            SET description = $1
            WHERE id = $2
            `,
            [description, chatId]
        );

        return { success: true, message: "Description updated successfully" };
    } catch (err) {
        console.error("Error updating description:", err);
        return { success: false, message: "Error updating description" };
    }
};
