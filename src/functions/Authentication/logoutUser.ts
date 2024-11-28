const { pool } = require('../../database');


export const logoutUser = async (currentUserId: number): Promise<any> => {

    const result = await pool.query('UPDATE users SET is_online = false WHERE id = $1', [currentUserId]);
    return result.rows[0];
};
