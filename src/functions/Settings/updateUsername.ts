const { pool } = require('../../database');

export const updateUsername = async (
    currentUserId: number,
    username: string
): Promise<{ success: boolean; message: string }> => {
    try {
        if (username.trim().length < 1) {
            return { success: false, message: "Username must be at least 1 character long" };
        }
        if (/\s/.test(username)) {
            return { success: false, message: "Username cannot contain spaces" };
        }

        // Check if the username already exists
        const existingUserQuery = `
            SELECT id FROM users WHERE username = $1
        `;
        const existingUser = await pool.query(existingUserQuery, [username]);
        if (existingUser.rows.length > 0) {
            return { success: false, message: "Username already exists" };
        }

        // Update the username in the database
        const updateQuery = `
            UPDATE users
            SET username = $1
            WHERE id = $2
        `;
        await pool.query(updateQuery, [username, currentUserId]);

        return { success: true, message: "Username updated successfully" };
    } catch (err) {
        console.error("Error updating username:", err);
        return { success: false, message: "Error updating username" };
    }
};
