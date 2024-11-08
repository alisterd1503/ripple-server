const { pool } = require("./database");

const createUsersTable = async() => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                password VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                role VARCHAR(50) DEFAULT 'user',
                bio VARCHAR(100) DEFAULT 'Hey there! I am using ChatApp'
            );
        `);
        console.log('users table created')
    } catch (err) {
      console.error('Error creating users table', err);
    }
}

const createChatsTable = async() => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chats (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100),
                is_group_chat BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('chats table created')
    } catch (err) {
      console.error('Error creating chats table', err);
    }
}

const createChatUsersTable = async() => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS chat_users (
                PRIMARY KEY (chat_id, user_id),
                chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('chat_users table created')
    } catch (err) {
      console.error('Error creating chat_users table', err);
    }
}

const createMessagesTable = async() => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id INT REFERENCES chats(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('messages table created')
    } catch (err) {
      console.error('Error creating messages table', err);
    }
}

module.exports = {
    createUsersTable,
    createChatsTable,
    createChatUsersTable,
    createMessagesTable
};