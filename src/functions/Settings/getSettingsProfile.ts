const { pool } = require('../../database');

interface ProfileModel {
    username: string
    avatar: string,
    bio: string,
    created_at: string,
    is_online: boolean
}


export const getProfile = async (currentUserId: number): Promise<ProfileModel> => {

    const query = `
        SELECT username, bio, avatar, created_at, is_online
        FROM users
        WHERE id = $1;
    `;
    
    const result = await pool.query(query, [currentUserId]);
    const profileData = result.rows[0];
    console.log(profileData)

    return profileData
};
