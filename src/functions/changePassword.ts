const { pool } = require("../database");

export const changePassword = async (
    currentUserId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
): Promise<{ success: boolean; message: string }> => {

    try {
        // Fetch the user's stored password from the database
        const query = `
            SELECT password
            FROM users
            WHERE id = $1;
        `;
        const result = await pool.query(query, [currentUserId]);
        const storedPassword = result.rows[0]?.password;

        if (!storedPassword) {
            return { success: false, message: "User not found" };
        }

        // Verify the current password
        if (currentPassword !== storedPassword) {
            return { success: false, message: "Invalid current password" };
        }

        // Ensure new passwords match
        if (newPassword !== confirmPassword) {
            return { success: false, message: "New passwords do not match" };
        }

        // Update the password
        const updateQuery = `
            UPDATE users
            SET password = $1
            WHERE id = $2;
        `;
        await pool.query(updateQuery, [newPassword, currentUserId]);

        return { success: true, message: "Password updated successfully" };
    } catch (err) {
        console.error("Error updating password:", err);
        return { success: false, message: "Error updating password" };
    }
};
