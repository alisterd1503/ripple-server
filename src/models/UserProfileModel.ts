export interface UserProfile {
    userId: number;
    username: string;
    avatar: string;
    bio: string;
    added_at: string | null;
    groups_in: {
        chatId: number;
        title: string;
        groupAvatar: string;
    }[];
}