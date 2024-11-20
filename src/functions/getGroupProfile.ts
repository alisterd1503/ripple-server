import { GroupProfile } from "../models/GroupProfileModel";
const { pool } = require("../database");

export const getGroupProfile = async (currentUserId: number, chatId: number): Promise<{ success: boolean; message: string; data?: GroupProfile }> => {
    try {
        // Fetch group chat details
        const chatQuery = `
            SELECT 
                c.title, 
                c.description, 
                c.group_avatar, 
                c.created_at
            FROM chats c
            WHERE c.id = $1 AND c.is_group_chat = true
        `;
        const chatResult = await pool.query(chatQuery, [chatId]);
        const chatDetails = chatResult.rows[0];

        if (!chatDetails) {
            return { success: false, message: 'Chat not found or access denied' };
        }

        // Fetch favourite status for the current user in this group
        const isFavouriteQuery = `
            SELECT cu.is_favourite
            FROM chat_users cu
            WHERE cu.chat_id = $1 AND cu.user_id = $2
        `;
        const isFavouriteResult = await pool.query(isFavouriteQuery, [chatId, currentUserId]);
        const isFavourite = isFavouriteResult.rows.length > 0 ? isFavouriteResult.rows[0].is_favourite : false;

        // Fetch members of the group
        const membersQuery = `
            SELECT 
                u.id AS user_id,
                u.username,
                u.avatar,
                u.bio,
                cu.added_at
            FROM users u
            JOIN chat_users cu ON u.id = cu.user_id
            WHERE cu.chat_id = $1
            ORDER BY cu.added_at ASC
        `;
        const membersResult = await pool.query(membersQuery, [chatId]);
        const members = membersResult.rows.map((row: { user_id: number; username: string; avatar: string; bio: string }) => ({
            userId: row.user_id,
            username: row.username,
            avatar: row.avatar,
            bio: row.bio,
        }));

        // Construct the response
        const response: GroupProfile = {
            title: chatDetails.title,
            description: chatDetails.description,
            groupAvatar: chatDetails.group_avatar,
            created_at: chatDetails.created_at,
            added_at: members.find((member: { userId: number; }) => member.userId === currentUserId)?.added_at || null,
            is_favourite: isFavourite,
            members,
        };

        return { success: true, message: 'Group profile fetched successfully', data: response };
    } catch (err) {
        console.error('Error fetching group profile:', err);
        return { success: false, message: 'Error fetching group profile' };
    }
};
