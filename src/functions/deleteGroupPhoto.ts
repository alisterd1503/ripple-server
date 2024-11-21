const { pool } = require("../database");

export const deleteGroupPhoto = async (chatId: number): Promise<{ success: boolean; message: string }> => {
    try {
        // Update the group photo to null (deleting it)
        await pool.query(
            'UPDATE chats SET group_avatar = $1 WHERE id = $2',
            [null, chatId]
        );

        return { success: true, message: 'Group photo deleted successfully' };
    } catch (err) {
        console.error('Error deleting photo:', err);
        return { success: false, message: 'Error deleting photo' };
    }
};
