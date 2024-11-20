import { MessageModel } from "../models/MessageModel";
import { verifyToken } from "../services/jwtService";
import { formatMessages } from "../utils/formatMessages";
const { pool } = require("../database");

export const getMessages = async (token: string, chatId: number): Promise<MessageModel[]> => {
    const currentUserId = verifyToken(token);

    if (!currentUserId) throw new Error("Invalid token");

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
