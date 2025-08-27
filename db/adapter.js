const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJson(file) {
	try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch { return []; }
}
function writeJson(file, data) {
	fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

async function createPool() {
	const host = process.env.DB_HOST || '127.0.0.1';
	const user = process.env.DB_USER || 'root';
	const password = process.env.DB_PASSWORD || '';
	const database = process.env.DB_NAME || 'ow_farm';
	const port = Number(process.env.DB_PORT || 3306);
	try {
		const pool = await mysql.createPool({ host, user, password, database, port, waitForConnections: true, connectionLimit: 10 });
		await pool.query('SELECT 1');
		return pool;
	} catch (e) {
		return null; // fallback to JSON
	}
}

async function getDb() {
	if (!global.__ow_db_pool_inited) {
		global.__ow_db_pool = await createPool();
		global.__ow_db_pool_inited = true;
	}
	return global.__ow_db_pool;
}

module.exports = {
	getDb,
	readJson,
	writeJson,
};