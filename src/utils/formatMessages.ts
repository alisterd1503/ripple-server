import { MessageModel } from "../models/MessageModel";

export const formatMessages = (data: any[], currentUserId: number): MessageModel[] => {
    return data.map((message) => {

        const direction = message.user_id === currentUserId ? "outgoing" : "incoming";
        const position = "single"

        return {
            userId: message.user_id,
            username: message.username,
            avatar: message.avatar,
            message: message.message,
            isImage: message.is_image,
            createdAt: message.created_at,
            direction,
            position,
        };
    });
};