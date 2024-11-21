const { pool } = require('../../database');

export const getUsers = async (currentUserId: number): Promise<{ userId: number; username: string; avatar: string }[]> => {

    const result = await pool.query(
        `SELECT id AS "userId", username, avatar FROM users WHERE id != $1;`,
        [currentUserId]
    );
    return result.rows;
};