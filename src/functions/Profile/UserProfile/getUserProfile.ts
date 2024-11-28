import { UserProfile } from "../../../models/UserProfileModel";
const { pool } = require('../../../database');

export const getUserProfile = async (currentUserId: number, userId: number): Promise<{ success: boolean; message: string; data?: UserProfile }> => {
    try {
        // Retrieve user profile information
        const userProfileQuery = `
            SELECT 
                u.id AS user_id, 
                u.username, 
                u.avatar, 
                u.bio,
                u.is_online
            FROM users u
            WHERE u.id = $1
        `;
        const userProfileResult = await pool.query(userProfileQuery, [userId]);
        const userProfile = userProfileResult.rows[0];

        if (!userProfile) {
            return { success: false, message: 'User not found' };
        }

        // Retrieve the added_at date (direct chat between the two users, not a group chat)
        const addedAtQuery = `
            SELECT cu.added_at, cu.is_favourite
            FROM chat_users cu
            JOIN chats c ON cu.chat_id = c.id
            WHERE c.is_group_chat = false
              AND cu.user_id = $1
              AND c.id IN (
                SELECT cu2.chat_id
                FROM chat_users cu2
                WHERE cu2.user_id = $2
              )
            ORDER BY cu.added_at ASC
            LIMIT 1
        `;
        const addedAtResult = await pool.query(addedAtQuery, [currentUserId, userId]);
        const addedAt = addedAtResult.rows.length > 0 ? addedAtResult.rows[0].added_at : null;
        const isFavourite = addedAtResult.rows.length > 0 ? addedAtResult.rows[0].is_favourite : false;

        const groupsInQuery = `
        SELECT 
            c.id AS chat_id, 
            c.title, 
            c.group_avatar
        FROM chats c
        JOIN chat_users cu1 ON c.id = cu1.chat_id AND cu1.user_id = $1
        JOIN chat_users cu2 ON c.id = cu2.chat_id AND cu2.user_id = $2
        WHERE c.is_group_chat = true
        `;
        const groupsInResult = await pool.query(groupsInQuery, [userId, currentUserId]);

        // Fetch members for each group chat
        const groupsInWithMembers = await Promise.all(
            groupsInResult.rows.map(async (group: { chat_id: number, title: string, group_avatar: string }) => {
                const membersQuery = `
                    SELECT 
                        u.username 
                    FROM users u
                    JOIN chat_users cu ON u.id = cu.user_id
                    WHERE cu.chat_id = $1
                `;
                const membersResult = await pool.query(membersQuery, [group.chat_id]);
                const members = membersResult.rows.map((row: { username: string }) => row.username);

                return {
                    chatId: group.chat_id,
                    title: group.title,
                    groupAvatar: group.group_avatar,
                    members,
                };
            })
        );

        const response: UserProfile = {
            userId: userProfile.user_id,
            username: userProfile.username,
            avatar: userProfile.avatar,
            bio: userProfile.bio,
            added_at: addedAt,
            groups_in: groupsInWithMembers,
            is_favourite: isFavourite,
            is_online: userProfile.is_online
        };

        return { success: true, message: 'User profile fetched successfully', data: response };
    } catch (err) {
        console.error('Error fetching user profile:', err);
        return { success: false, message: 'Error fetching user profile' };
    }
};
