const { pool } = require('../../database');

export const deletePhoto = async (
    currentUserId: number
): Promise<{ success: boolean; message: string }> => {
    try {
        // Update the avatar field to NULL for the current user
        const updateQuery = `
            UPDATE users
            SET avatar = $1
            WHERE id = $2
        `;
        await pool.query(updateQuery, [null, currentUserId]);

        return { success: true, message: "Profile photo deleted successfully" };
    } catch (err) {
        console.error("Error deleting profile photo:", err);
        return { success: false, message: "Error deleting profile photo" };
    }
};