require('dotenv').config();
const { getDb, readJson, writeJson } = require('./db/adapter');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'uazuuhonga@yahoo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'HongaFotjinene@25';

async function seedAdmin() {
    const db = await getDb();
    if (db) {
        console.log('Seeding/updating admin user to database...');
        try {
            // Check if admin user already exists
            const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_USERNAME]);
            if (existing.length > 0) {
                // Update existing admin user
                await db.execute(
                    'UPDATE users SET name = ?, phone = ?, location = ?, user_type = ?, status = ? WHERE email = ?',
                    ['Mr Honga', '+264 81 122 0667', 'Windhoek', 'admin', 'active', ADMIN_USERNAME]
                );
                console.log('Admin user updated.');
            } else {
                // Insert new admin user
                const [result] = await db.execute(
                    'INSERT INTO users (name, email, phone, location, user_type, status) VALUES (?, ?, ?, ?, ?, ?)',
                    ['Mr Honga', ADMIN_USERNAME, '+264 81 122 0667', 'Windhoek', 'admin', 'active']
                );
                console.log(`Admin user seeded with ID ${result.insertId}`);
            }
        } catch (e) {
            console.error('Error seeding/updating admin user:', e.message);
        }
    } else {
        console.log('No database connection, seeding/updating admin to JSON...');
        const users = readJson('users.json');
        const existingIndex = users.findIndex(u => u.email === ADMIN_USERNAME);
        if (existingIndex >= 0) {
            // Update existing admin user
            users[existingIndex].name = 'Mr Honga';
            users[existingIndex].phone = '+264 81 122 0667';
            users[existingIndex].location = 'Windhoek';
            users[existingIndex].type = 'admin';
            users[existingIndex].status = 'active';
            users[existingIndex].updatedAt = new Date().toISOString();
            console.log('Admin user updated in JSON.');
        } else {
            // Insert new admin user
            users.push({
                id: Date.now().toString(),
                name: 'Mr Honga',
                email: ADMIN_USERNAME,
                phone: '+264 81 122 0667',
                location: 'Windhoek',
                type: 'admin',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('Admin user seeded to JSON.');
        }
        writeJson('users.json', users);
    }
}

seedAdmin().catch(console.error);
