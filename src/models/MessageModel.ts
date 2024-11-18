export interface MessageModel {
    userId: number;
    username: string;
    message: string;
    isImage: string;
    createdAt: string;
    direction: "outgoing" | "incoming";
    position: "first" | "last" | "single";
}