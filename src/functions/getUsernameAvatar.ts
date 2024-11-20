import { verifyToken } from "../services/jwtService";
const { pool } = require("../database");

interface UsernameAvatarResponse {
    username: string;
    avatar: string | null;
}

export const getUsernameAvatar = async (token: string): Promise<UsernameAvatarResponse> => {
    const currentUserId = verifyToken(token);

    if (!currentUserId) throw new Error("Invalid token");

    const query = `
        SELECT username, avatar FROM users WHERE id = $1
    `;

    const result = await pool.query(query, [currentUserId]);

    if (result.rows.length === 0) throw new Error("User not found");

    return result.rows[0];
};
