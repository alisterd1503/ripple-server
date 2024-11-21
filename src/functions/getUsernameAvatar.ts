const { pool } = require("../database");

interface UsernameAvatarResponse {
    username: string;
    avatar: string | null;
}

export const getUsernameAvatar = async (currentUserId: number): Promise<UsernameAvatarResponse> => {

    const query = `
        SELECT username, avatar FROM users WHERE id = $1
    `;

    const result = await pool.query(query, [currentUserId]);

    if (result.rows.length === 0) throw new Error("User not found");

    return result.rows[0];
};
