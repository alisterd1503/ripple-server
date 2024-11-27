import { MessageModel } from "../models/MessageModel";

export const formatMessages = (data: any[], currentUserId: number): MessageModel[] => {
    return data.map((message) => {

        const direction = message.user_id === currentUserId ? "outgoing" : "incoming";
        const position = "single"

        return {
            id: message.message_id,
            userId: message.user_id,
            username: message.sender_username,
            avatar: message.avatar,
            message: message.message,
            isImage: message.is_image,
            createdAt: message.created_at,
            direction,
            position,
            readBy: message.read_by
        };
    });
};