const { pool } = require('../../database');

interface PostMessageResponse {
    id: number;
    chatId: number;
    userId: number;
    message: string;
    isImage: boolean;
    createdAt: string;
    imageUrl?: string;
}

export const postMessage = async (
    currentUserId: number,
    chatId: number,
    message: string,
    file: Express.Multer.File | undefined
): Promise<PostMessageResponse> => {
    
    const isImage = !!file;
    const content = isImage && file ? `/uploads/${file.filename}` : message;

    const insertResult = await pool.query(
        `
        INSERT INTO messages (chat_id, user_id, message, is_image) 
        VALUES ($1, $2, $3, $4) RETURNING *`,
        [chatId, currentUserId, content, isImage]
    );

    return {
        ...insertResult.rows[0],
        imageUrl: isImage ? content : null,
    };
};
