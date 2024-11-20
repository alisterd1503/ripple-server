import validatePassword from "../utils/validatePassword";
const { pool } = require("../database");

interface RegisterUserRequest {
    username: string;
    password: string;
}

export const registerUser = async (body: RegisterUserRequest): Promise<{ success: boolean; message: string }> => {
    
    // Validating Usernames
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [body.username]);
    if (existingUser.rows.length > 0) return { success: false, message: 'Username already exists' };
    if (body.username.trim().length < 1) return { success: false, message: 'Username must be at least one character long.' };
    if (/\s/.test(body.username)) return { success: false, message: 'Username cannot contain spaces.' };

    // Validating Password
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) return { success: false, message: passwordValidation.message };

    try {
        const insertResult = await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, avatar',
            [body.username, body.password]
        );

        const newUser = insertResult.rows[0];
        return { success: true, message: 'User registered successfully' };
    } catch (err) {
        console.error('Error registering user:', err);
        return { success: false, message: 'Error registering user' };
    }
};
