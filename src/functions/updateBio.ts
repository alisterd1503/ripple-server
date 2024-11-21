const { pool } = require("../database");

export const updateBio = async (
    currentUserId: number,
    bio: string
): Promise<{ success: boolean; message: string }> => {
    try {
        if (bio.length < 1) {
            return { success: false, message: "Bio cannot be empty" };
        }
        if (bio.length > 100) {
            return { success: false, message: "Bio cannot exceed 100 characters" };
        }

        // Update the bio in the database
        const query = `
            UPDATE users
            SET bio = $1
            WHERE id = $2;
        `;
        await pool.query(query, [bio, currentUserId]);

        return { success: true, message: "Bio updated successfully" };
    } catch (err) {
        console.error("Error updating bio:", err);
        return { success: false, message: "Error updating bio" };
    }
};
