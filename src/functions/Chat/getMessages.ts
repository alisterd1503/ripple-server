import { MessageModel } from "../../models/MessageModel";
import { formatMessages } from "../../utils/formatMessages";

const { pool } = require('../../database');

export const getMessages = async (currentUserId: number, chatId: number): Promise<MessageModel[]> => {

    const result = await pool.query(
        `
        SELECT m.message, m.created_at, m.user_id, m.is_image, u.username, u.avatar
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.chat_id = $1
        ORDER BY m.created_at ASC
        `,
        [chatId]
    );

    const messages: MessageModel[] = formatMessages(result.rows, currentUserId)
    return messages
};
