export interface FormattedMessage {
    userId: number;
    username: string;
    message: string;
    createdAt: string;
    direction: "outgoing" | "incoming";
    position: "first" | "last" | "single";
}

export interface Message {
    userId: number,
    username: string,
    message: string,
    createdAt: Date,
}