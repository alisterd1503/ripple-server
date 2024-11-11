//import { FormattedMessage, Message } from "./messageModel";

interface FormattedMessage {
    userId: number;
    username: string;
    message: string;
    createdAt: string;
    direction: "outgoing" | "incoming";
    position: "first" | "last" | "single";
}

interface Message {
    userId: number,
    username: string,
    message: string,
    createdAt: Date,
}

export const formatData = (data: any[], currentUserId: number): FormattedMessage[] => {
    return data.map((message) => {

        const direction = message.user_id === currentUserId ? "outgoing" : "incoming";
        const position = "single"

        return {
            userId: message.user_id,
            username: message.username,
            message: message.message,
            createdAt: message.created_at,
            direction,
            position,
        };
    });
};