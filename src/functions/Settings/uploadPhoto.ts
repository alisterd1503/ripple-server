const { pool } = require('../../database');

export const uploadPhoto = async (
    currentUserId: number,
    file: Express.Multer.File | undefined
): Promise<{ success: boolean; message: string; avatarPath?: string }> => {
    try {
        if (!file) {
            return { success: false, message: "No file uploaded" };
        }

        // Construct the file path
        const avatarPath = `/uploads/${file.filename}`;

        // Update the user's avatar in the database
        const updateQuery = `
            UPDATE users
            SET avatar = $1
            WHERE id = $2
        `;
        await pool.query(updateQuery, [avatarPath, currentUserId]);

        return {
            success: true,
            message: "Avatar uploaded successfully",
            avatarPath,
        };
    } catch (error) {
        console.error("Error uploading photo:", error);
        return { success: false, message: "Error uploading photo" };
    }
};
