export interface MessageModel {
    userId: number;
    username: string;
    message: string;
    avatar: string | null;
    isImage: boolean;
    createdAt: string;
    direction: "outgoing" | "incoming";
    position: "first" | "last" | "single";
    readBy: {
        username: string;
        time: string
      }[];
}  