import { MessageModel } from "../../models/MessageModel";
import { formatMessages } from "../../utils/formatMessages";
const { pool } = require('../../database');

export const getMessages = async (currentUserId: number, chatId: number): Promise<MessageModel[]> => {
    const client = await pool.connect();

    try {
        // Start transaction
        await client.query('BEGIN');

        // Fetch messages and their read receipts
        const result = await client.query(
            `
            SELECT 
                m.id AS message_id,
                m.message,
                m.created_at,
                m.user_id,
                m.is_image,
                u.username AS sender_username,
                u.avatar,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'username', ru.username,
                            'time', rr.read_at
                        )
                    ) FILTER (WHERE rr.user_id IS NOT NULL),
                    '[]'
                ) AS read_by
            FROM messages m
            JOIN users u ON m.user_id = u.id
            LEFT JOIN read_receipts rr ON rr.message_id = m.id
            LEFT JOIN users ru ON rr.user_id = ru.id
            WHERE m.chat_id = $1
            GROUP BY m.id, u.id
            ORDER BY m.created_at ASC
            `,
            [chatId]
        );

        const messages = result.rows;

        // Update `read_receipts` for the current user
        await client.query(
            `
            INSERT INTO read_receipts (message_id, user_id)
            SELECT id, $1
            FROM messages
            WHERE chat_id = $2
            ON CONFLICT (message_id, user_id) DO NOTHING
            `,
            [currentUserId, chatId]
        );

        // Commit transaction
        await client.query('COMMIT');

        // Format messages
        const formattedMessages: MessageModel[] = formatMessages(messages, currentUserId);
        console.log(formattedMessages)
        return formattedMessages;
    } catch (err) {
        // Rollback transaction in case of error
        await client.query('ROLLBACK');
        console.error('Error in getMessages:', err);
        throw new Error('Error fetching messages');
    } finally {
        client.release();
    }
};
