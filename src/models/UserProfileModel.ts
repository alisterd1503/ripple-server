export interface UserProfile {
    userId: number;
    username: string;
    avatar: string;
    bio: string;
    added_at: string | null;
    is_favourite: boolean;
    groups_in: {
        chatId: number;
        title: string;
        groupAvatar: string;
        members: string[];
    }[];
}