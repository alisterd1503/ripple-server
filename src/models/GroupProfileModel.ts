export interface GroupProfile {
    title: string;
    description: string;
    groupAvatar: string;
    created_at: string;
    added_at: string;
    members: {
      userId: number;
      username: string;
      avatar: string;
      bio: string;
    }[];
}