import { verifyToken } from "../services/jwtService";
const { pool } = require("../database");

export const getUsers = async (token: string): Promise<{ userId: number; username: string; avatar: string }[]> => {
    const currentUserId = verifyToken(token)

    if (!currentUserId) throw new Error('Invalid token');

    const result = await pool.query(
        `SELECT id AS "userId", username, avatar FROM users WHERE id != $1;`,
        [currentUserId]
    );
    return result.rows;
};