export interface ContactModel {
    chatId: number;
    title: string | null;
    username: string | null;
    userId: number | null;
    groupAvatar: string | null;
    avatar: string | null;
    isGroupChat: boolean;
    isOnline: boolean;
    lastMessage: string | null;
    isImage: boolean;
    lastMessageTime: string | null;
    lastMessageSender: string | null;
    members: string[] | null;
    isFavourite: boolean;
    unReadMessages: number;
    readLastMessage: boolean
}