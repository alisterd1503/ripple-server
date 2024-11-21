const { pool } = require("../database");

export const uploadGroupPhoto = async (chatId: number, file: Express.Multer.File | undefined): Promise<{ success: boolean; message: string; avatarPath?: string }> => {
    try {
        if (!file) {
            return { success: false, message: 'No file uploaded' };
        }

        const avatarPath = `/uploads/${file.filename}`;

        // Update the group photo in the database
        await pool.query(
            'UPDATE chats SET group_avatar = $1 WHERE id = $2',
            [avatarPath, chatId]
        );

        return { success: true, message: 'Photo uploaded successfully', avatarPath };
    } catch (error) {
        console.error('Error uploading photo:', error);
        return { success: false, message: 'Error uploading photo' };
    }
};
