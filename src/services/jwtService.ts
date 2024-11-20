import jwt, { JwtPayload } from 'jsonwebtoken';
const jwtSecret = process.env.JWT_SECRET || 'setPassword'

export const verifyToken = (token: string): number => {
    
    if (!jwtSecret) throw new Error('JWT secret not found');

    try {
        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
        const currentUserId = decoded.userId;

        if (!currentUserId) throw new Error('Token does not contain user ID')

        return currentUserId;
    } catch (error) {
        throw new Error('Invalid token');
    }
};