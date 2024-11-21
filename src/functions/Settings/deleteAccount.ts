const { pool } = require('../../database');

export const deleteAccount = async (
    currentUserId: number,
    currentPassword: string
): Promise<{ success: boolean; message: string }> => {
    try {
        // Retrieve the stored password for the user
        const result = await pool.query(
            "SELECT password FROM users WHERE id = $1",
            [currentUserId]
        );
        const storedPassword = result.rows[0]?.password;

        // Validate the current password
        if (currentPassword !== storedPassword) {
            return { success: false, message: "Invalid current password" };
        }

        // Delete the user's account from the database
        await pool.query("DELETE FROM users WHERE id = $1 RETURNING *", [
            currentUserId,
        ]);

        return { success: true, message: "Account deleted successfully" };
    } catch (err) {
        console.error("Error deleting account:", err);
        return { success: false, message: "Error deleting account" };
    }
};
