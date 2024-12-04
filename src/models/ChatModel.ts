export interface ChatModel {
    avatar: string | null;
    title: string | null;
    username: string | null;
    userId: number | null;
    groupAvatar: string | null;
    chatId: number;
    isGroupChat: boolean;
    members: string[] | null;
    isOnline: boolean;
}