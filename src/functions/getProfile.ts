const { pool } = require("../database");

interface ProfileModel {
    username: string
    avatar: string,
    bio: string,
    created_at: string
}


export const getProfile = async (currentUserId: number): Promise<ProfileModel> => {

    const query = `
        SELECT username, bio, avatar, created_at
        FROM users
        WHERE id = $1;
    `;
    
    const result = await pool.query(query, [currentUserId]);
    const profileData = result.rows[0];

    return profileData
};
