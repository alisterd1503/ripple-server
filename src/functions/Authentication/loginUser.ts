import jwt from 'jsonwebtoken';
const { pool } = require('../../database');

const jwtSecret = process.env.JWT_SECRET || 'setPassword';

interface LoginUserRequest {
    username: string;
    password: string;
}

export const loginUser = async (body: LoginUserRequest): Promise<{ success: boolean; message: string, token?: string }> => {
    // Check if user exists in the database
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [body.username]);
    const user = result.rows[0];

    if (!user) {
        return { success: false, message: 'Username not found' };
    }

    // Password validation
    if (body.password !== user.password) {
        return { success: false, message: 'Invalid password' };
    }

    // Create JWT token if credentials are correct
    const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        jwtSecret,
        { expiresIn: '4h' }
    );

    await pool.query('UPDATE users SET is_online = true WHERE id = $1', [user.id]);

    return { success: true, message: 'Login successful', token: token};
};
