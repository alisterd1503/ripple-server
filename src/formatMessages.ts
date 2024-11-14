import { MessageModel } from "./messageModel";

export const formatMessages = (data: any[], currentUserId: number): MessageModel[] => {
    return data.map((message) => {

        const direction = message.user_id === currentUserId ? "outgoing" : "incoming";
        const position = "single"

        return {
            userId: message.user_id,
            username: message.username,
            avatar: message.avatar,
            message: message.message,
            createdAt: message.created_at,
            direction,
            position,
        };
    });
};