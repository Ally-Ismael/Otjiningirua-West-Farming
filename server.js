const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const { getDb, readJson: readJsonFallback, writeJson: writeJsonFallback } = require('./db/adapter');

const ensureDirs = () => {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
	if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
};

const readJson = (file) => {
	try {
		return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
	} catch (e) {
		return [];
	}
};

const writeJson = (file, data) => {
	fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

const readJsonObject = (file) => {
	try {
		return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
	} catch (e) {
		return {};
	}
};

const writeJsonObject = (file, data) => {
	fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

const sendJson = (res, status, obj) => {
	res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
	res.end(JSON.stringify(obj));
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const activeSessions = new Set();

const parseCookies = (req) => {
	const header = req.headers['cookie'] || '';
	return header.split(';').reduce((acc, part) => {
		const [k, v] = part.trim().split('=');
		if (k) acc[k] = decodeURIComponent(v || '');
		return acc;
	}, {});
};

const parseBody = (req) => new Promise((resolve, reject) => {
	let body = '';
	req.on('data', chunk => {
		body += chunk.toString();
		if (body.length > 50 * 1024 * 1024) {
			reject(new Error('Payload too large'));
			req.destroy();
		}
	});
	req.on('end', () => {
		try {
			const contentType = req.headers['content-type'] || '';
			if (contentType.includes('application/json')) {
				resolve(JSON.parse(body || '{}'));
			} else if (contentType.includes('text/plain')) {
				resolve(body);
			} else if (!body) {
				resolve({});
			} else {
				resolve(JSON.parse(body));
			}
		} catch (e) {
			reject(e);
		}
	});
});

const serveStatic = (req, res) => {
	let filePath = req.url === '/' ? 'index.html' : req.url.slice(1);
	filePath = decodeURIComponent(filePath);
	const resolved = path.join(PUBLIC_DIR, filePath);
	if (!resolved.startsWith(PUBLIC_DIR)) {
		res.writeHead(403);
		return res.end('Forbidden');
	}
	fs.stat(resolved, (err, stat) => {
		if (err || !stat.isFile()) {
			res.writeHead(404);
			return res.end('Not found');
		}
		const ext = path.extname(resolved).toLowerCase();
		const map = {
			'.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
			'.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm'
		};
		res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
		fs.createReadStream(resolved).pipe(res);
	});
};

const routes = async (req, res) => {
	// CORS preflight
	if (req.method === 'OPTIONS') {
		res.writeHead(204, {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		});
		return res.end();
	}

	// Auth: login/logout/session
	if (req.url === '/api/admin/login' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			if ((body.password || '') !== ADMIN_PASSWORD) {
				res.writeHead(401, { 'Content-Type': 'application/json' });
				return res.end(JSON.stringify({ ok: false, error: 'Invalid credentials' }));
			}
			const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
			activeSessions.add(token);
			res.writeHead(200, {
				'Content-Type': 'application/json',
				'Set-Cookie': `admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
			});
			return res.end(JSON.stringify({ ok: true }));
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url === '/api/admin/logout' && req.method === 'POST') {
		const cookies = parseCookies(req);
		if (cookies.admin_session) activeSessions.delete(cookies.admin_session);
		res.writeHead(200, {
			'Content-Type': 'application/json',
			'Set-Cookie': 'admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
		});
		return res.end(JSON.stringify({ ok: true }));
	}
	if (req.url === '/api/admin/session' && req.method === 'GET') {
		const cookies = parseCookies(req);
		const ok = cookies.admin_session && activeSessions.has(cookies.admin_session);
		if (!ok) { res.writeHead(401); return res.end('Unauthorized'); }
		return sendJson(res, 200, { ok: true });
	}

	// Gate admin APIs except login/session
	if (req.url.startsWith('/api/admin/') && !['/api/admin/login','/api/admin/session'].includes(req.url)) {
		const cookies = parseCookies(req);
		const ok = cookies.admin_session && activeSessions.has(cookies.admin_session);
		if (!ok) { res.writeHead(401); return res.end('Unauthorized'); }
	}

	if (req.url === '/api/rams' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, name, description, breed, price, status, born_date AS bornDate, weight_kg AS weightKg, color, health_status AS healthStatus, bloodline, created_at AS createdAt, updated_at AS updatedAt FROM rams ORDER BY created_at DESC');
			const [media] = await db.query("SELECT parent_type, parent_id, media_type AS type, url FROM media WHERE parent_type='ram'");
			const byId = Object.fromEntries(rows.map(r => [String(r.id), { ...r, id: String(r.id), media: [] }]));
			for (const m of media) { const k = String(m.parent_id); if (byId[k]) byId[k].media.push({ type: m.type, url: m.url }); }
			return sendJson(res, 200, Object.values(byId));
		}
		return sendJson(res, 200, readJsonFallback('rams.json'));
	}
	if (req.url === '/api/beans' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, name, description, variety, price_per_kg AS pricePerKg, status, created_at AS createdAt, updated_at AS updatedAt FROM beans ORDER BY created_at DESC');
			const [media] = await db.query("SELECT parent_type, parent_id, media_type AS type, url FROM media WHERE parent_type='bean'");
			const byId = Object.fromEntries(rows.map(r => [String(r.id), { ...r, id: String(r.id), media: [] }]));
			for (const m of media) { const k = String(m.parent_id); if (byId[k]) byId[k].media.push({ type: m.type, url: m.url }); }
			return sendJson(res, 200, Object.values(byId));
		}
		return sendJson(res, 200, readJsonFallback('beans.json'));
	}
	if (req.url === '/api/inquiries' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('INSERT INTO inquiries (product, name, email, phone, quantity, message) VALUES (?,?,?,?,?,?)', [body.product||null, body.name||null, body.email||null, body.phone||null, body.quantity||null, body.message||null]);
				return sendJson(res, 201, { ok: true });
			}
			const inquiries = readJsonFallback('inquiries.json');
			inquiries.push({ id: Date.now().toString(), createdAt: new Date().toISOString(), ...body });
			writeJsonFallback('inquiries.json', inquiries);
			return sendJson(res, 201, { ok: true });
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}
	if (req.url === '/api/admin/rams' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				const [r] = await db.execute('INSERT INTO rams (name, description, breed, price, status, born_date, weight_kg, color, health_status, bloodline) VALUES (?,?,?,?,?,?,?,?,?,?)', [body.name||'', body.description||null, body.breed||null, body.price||null, body.status||'available', body.bornDate||null, body.weightKg||null, body.color||null, body.healthStatus||null, body.bloodline||null]);
				const ram = { id: String(r.insertId), createdAt: new Date().toISOString(), media: [], ...body };
				logActivity('create', 'ram', ram.id, ram);
				return sendJson(res, 201, ram);
			}
			const rams = readJson('rams.json');
			const ram = { id: Date.now().toString(), createdAt: new Date().toISOString(), media: [], ...body };
			rams.push(ram);
			writeJson('rams.json', rams);
			logActivity('create', 'ram', ram.id, ram);
			return sendJson(res, 201, ram);
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}
	if (req.url.startsWith('/api/admin/rams/') && req.method === 'PUT') {
		try {
			const id = req.url.split('/').pop();
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('UPDATE rams SET name=COALESCE(?,name), description=COALESCE(?,description), breed=COALESCE(?,breed), price=COALESCE(?,price), status=COALESCE(?,status), born_date=COALESCE(?,born_date), weight_kg=COALESCE(?,weight_kg), color=COALESCE(?,color), health_status=COALESCE(?,health_status), bloodline=COALESCE(?,bloodline) WHERE id=?', [body.name, body.description, body.breed, body.price, body.status, body.bornDate, body.weightKg, body.color, body.healthStatus, body.bloodline, id]);
				logActivity('update', 'ram', id, body);
				return sendJson(res, 200, { ok: true });
			}
			const rams = readJson('rams.json');
			const idx = rams.findIndex(r => r.id === id);
			if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Not found' });
			rams[idx] = { ...rams[idx], ...body };
			writeJson('rams.json', rams);
			logActivity('update', 'ram', id, body);
			return sendJson(res, 200, rams[idx]);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/rams/') && req.method === 'DELETE') {
		const id = req.url.split('/').pop();
		const db = await getDb();
		if (db) {
			await db.execute('DELETE FROM rams WHERE id=?', [id]);
			logActivity('delete', 'ram', id, {});
			return sendJson(res, 200, { ok: true });
		}
		const rams = readJson('rams.json');
		const next = rams.filter(r => r.id !== id);
		writeJson('rams.json', next);
		logActivity('delete', 'ram', id, {});
		return sendJson(res, 200, { ok: true });
	}
	if (req.url === '/api/admin/beans' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				const [r] = await db.execute('INSERT INTO beans (name, description, variety, price_per_kg, status) VALUES (?,?,?,?,?)', [body.name||'', body.description||null, body.variety||null, body.pricePerKg||null, body.status||'available']);
				const bean = { id: String(r.insertId), createdAt: new Date().toISOString(), media: [], ...body };
				logActivity('create', 'bean', bean.id, bean);
				return sendJson(res, 201, bean);
			}
			const beans = readJson('beans.json');
			const bean = { id: Date.now().toString(), createdAt: new Date().toISOString(), media: [], ...body };
			beans.push(bean);
			writeJson('beans.json', beans);
			logActivity('create', 'bean', bean.id, bean);
			return sendJson(res, 201, bean);
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}
	if (req.url.startsWith('/api/admin/beans/') && req.method === 'PUT') {
		try {
			const id = req.url.split('/').pop();
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('UPDATE beans SET name=COALESCE(?,name), description=COALESCE(?,description), variety=COALESCE(?,variety), price_per_kg=COALESCE(?,price_per_kg), status=COALESCE(?,status) WHERE id=?', [body.name, body.description, body.variety, body.pricePerKg, body.status, id]);
				logActivity('update', 'bean', id, body);
				return sendJson(res, 200, { ok: true });
			}
			const beans = readJson('beans.json');
			const idx = beans.findIndex(b => b.id === id);
			if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Not found' });
			beans[idx] = { ...beans[idx], ...body };
			writeJson('beans.json', beans);
			logActivity('update', 'bean', id, body);
			return sendJson(res, 200, beans[idx]);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/beans/') && req.method === 'DELETE') {
		const id = req.url.split('/').pop();
		const db = await getDb();
		if (db) {
			await db.execute('DELETE FROM beans WHERE id=?', [id]);
			logActivity('delete', 'bean', id, {});
			return sendJson(res, 200, { ok: true });
		}
		const beans = readJson('beans.json');
		const next = beans.filter(b => b.id !== id);
		writeJson('beans.json', next);
		logActivity('delete', 'bean', id, {});
		return sendJson(res, 200, { ok: true });
	}
	if (req.url.startsWith('/api/admin/upload') && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const { parentType, parentId, base64, filename, mediaType } = body;
			if (!parentType || !parentId || !base64 || !filename) {
				return sendJson(res, 400, { ok: false, error: 'Missing fields' });
			}
			const buffer = Buffer.from(base64, 'base64');
			const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
			const outPath = path.join(UPLOADS_DIR, safeName);
			fs.writeFileSync(outPath, buffer);
			const publicUrl = `/uploads/${safeName}`;
			const ext = path.extname(safeName).toLowerCase();
			const inferredType = mediaType || (['.png','.jpg','.jpeg','.gif','.webp'].includes(ext) ? 'image' : ['.mp4','.webm','.mov','.m4v'].includes(ext) ? 'video' : 'image');
			const db = await getDb();
			if (db) {
				await db.execute('INSERT INTO media (parent_type, parent_id, media_type, url) VALUES (?,?,?,?)', [parentType, parentId, inferredType, publicUrl]);
				logActivity('upload', parentType === 'ram' ? 'ram_media' : 'bean_media', parentId, { url: publicUrl, filename: safeName });
			} else {
				if (parentType === 'ram') {
					const rams = readJson('rams.json');
					const idx = rams.findIndex(r => r.id === parentId);
					if (idx >= 0) {
						rams[idx].media = rams[idx].media || [];
						rams[idx].media.push({ type: inferredType, url: publicUrl, filename: safeName });
						writeJson('rams.json', rams);
						logActivity('upload', 'ram_media', parentId, { url: publicUrl, filename: safeName });
					}
				}
				if (parentType === 'bean') {
					const beans = readJson('beans.json');
					const idx = beans.findIndex(b => b.id === parentId);
					if (idx >= 0) {
						beans[idx].media = beans[idx].media || [];
						beans[idx].media.push({ type: inferredType, url: publicUrl, filename: safeName });
						writeJson('beans.json', beans);
						logActivity('upload', 'bean_media', parentId, { url: publicUrl, filename: safeName });
					}
				}
			}
			return sendJson(res, 201, { ok: true, url: publicUrl });
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}

	// --- Admin: Users CRUD ---
	if (req.url === '/api/admin/users' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, name, email, phone, location, user_type AS type, status, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY created_at DESC');
			return sendJson(res, 200, rows.map(r => ({ ...r, id: String(r.id) })));
		}
		return sendJson(res, 200, readJsonFallback('users.json'));
	}
	if (req.url === '/api/admin/users' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				const [r] = await db.execute('INSERT INTO users (name, email, phone, location, user_type, status) VALUES (?,?,?,?,?,?)', [body.name||'', body.email||null, body.phone||null, body.location||null, body.type||'individual', body.status||'active']);
				const user = { id: String(r.insertId), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body };
				logActivity('create', 'user', user.id, user);
				return sendJson(res, 201, user);
			}
			const users = readJsonFallback('users.json');
			const user = { id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body };
			users.push(user);
			writeJsonFallback('users.json', users);
			logActivity('create', 'user', user.id, user);
			return sendJson(res, 201, user);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/users/') && req.method === 'PUT') {
		try {
			const id = req.url.split('/').pop();
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone), location=COALESCE(?,location), user_type=COALESCE(?,user_type), status=COALESCE(?,status) WHERE id=?', [body.name, body.email, body.phone, body.location, body.type, body.status, id]);
				logActivity('update', 'user', id, body);
				return sendJson(res, 200, { ok: true });
			}
			const users = readJson('users.json');
			const idx = users.findIndex(u => u.id === id);
			if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Not found' });
			users[idx] = { ...users[idx], ...body, updatedAt: new Date().toISOString() };
			writeJson('users.json', users);
			logActivity('update', 'user', id, body);
			return sendJson(res, 200, users[idx]);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/users/') && req.method === 'DELETE') {
		const id = req.url.split('/').pop();
		const db = await getDb();
		if (db) {
			await db.execute('DELETE FROM users WHERE id=?', [id]);
			logActivity('delete', 'user', id, {});
			return sendJson(res, 200, { ok: true });
		}
		const users = readJsonFallback('users.json');
		const next = users.filter(u => u.id !== id);
		writeJson('users.json', next);
		logActivity('delete', 'user', id, {});
		return sendJson(res, 200, { ok: true });
	}

	// --- Admin: Orders CRUD ---
	if (req.url === '/api/admin/orders' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, user_id AS userId, status, total_amount AS totalAmount, created_at AS createdAt, updated_at AS updatedAt FROM orders ORDER BY created_at DESC');
			return sendJson(res, 200, rows.map(r => ({ ...r, id: String(r.id) })));
		}
		return sendJson(res, 200, readJson('orders.json'));
	}
	if (req.url === '/api/admin/orders' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				const [r] = await db.execute('INSERT INTO orders (user_id, status, total_amount) VALUES (?,?,?)', [body.userId||null, body.status||'pending', body.totalAmount||0]);
				const order = { id: String(r.insertId), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: body.status||'pending', totalAmount: body.totalAmount||0, userId: body.userId||null };
				logActivity('create', 'order', order.id, order);
				return sendJson(res, 201, order);
			}
			const orders = readJson('orders.json');
			const order = { id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'pending', items: [], ...body };
			orders.push(order);
			writeJson('orders.json', orders);
			logActivity('create', 'order', order.id, order);
			return sendJson(res, 201, order);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/orders/') && req.method === 'PUT') {
		try {
			const id = req.url.split('/').pop();
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('UPDATE orders SET user_id=COALESCE(?,user_id), status=COALESCE(?,status), total_amount=COALESCE(?,total_amount) WHERE id=?', [body.userId, body.status, body.totalAmount, id]);
				logActivity('update', 'order', id, body);
				return sendJson(res, 200, { ok: true });
			}
			const orders = readJson('orders.json');
			const idx = orders.findIndex(o => o.id === id);
			if (idx < 0) return sendJson(res, 404, { ok: false, error: 'Not found' });
			orders[idx] = { ...orders[idx], ...body, updatedAt: new Date().toISOString() };
			writeJson('orders.json', orders);
			logActivity('update', 'order', id, body);
			return sendJson(res, 200, orders[idx]);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/orders/') && req.method === 'DELETE') {
		const id = req.url.split('/').pop();
		const db = await getDb();
		if (db) {
			await db.execute('DELETE FROM orders WHERE id=?', [id]);
			logActivity('delete', 'order', id, {});
			return sendJson(res, 200, { ok: true });
		}
		const orders = readJson('orders.json');
		const next = orders.filter(o => o.id !== id);
		writeJson('orders.json', next);
		logActivity('delete', 'order', id, {});
		return sendJson(res, 200, { ok: true });
	}

	// --- Admin: Stock movements & summary ---
	if (req.url === '/api/admin/stock/movements' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, product_type AS productType, product_id AS productId, quantity_change AS quantityChange, note, created_at AS createdAt FROM stock_movements ORDER BY created_at DESC');
			return sendJson(res, 200, rows.map(r => ({ ...r, id: String(r.id) })));
		}
		return sendJson(res, 200, readJson('stock_movements.json'));
	}
	if (req.url === '/api/admin/stock/movements' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				const [r] = await db.execute('INSERT INTO stock_movements (product_type, product_id, quantity_change, note) VALUES (?,?,?,?)', [body.productType, body.productId, body.quantityChange, body.note||null]);
				const mv = { id: String(r.insertId), createdAt: new Date().toISOString(), ...body };
				logActivity('create', 'stock_movement', mv.id, mv);
				return sendJson(res, 201, mv);
			}
			const movements = readJson('stock_movements.json');
			const mv = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...body };
			movements.push(mv);
			writeJson('stock_movements.json', movements);
			logActivity('create', 'stock_movement', mv.id, mv);
			return sendJson(res, 201, mv);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/stock/summary') && req.method === 'GET') {
		const url = new URL(req.url, 'http://localhost');
		const type = url.searchParams.get('type');
		const db = await getDb();
		if (db) {
			let q = 'SELECT product_type AS productType, product_id AS productId, SUM(quantity_change) AS stock FROM stock_movements';
			const params = [];
			if (type) { q += ' WHERE product_type=?'; params.push(type); }
			q += ' GROUP BY product_type, product_id';
			const [rows] = await db.query(q, params);
			const result = rows.map(r => ({ productId: String(r.productId), name: '', type: r.productType, stock: Number(r.stock||0) }));
			const ramIds = result.filter(r => r.type==='ram').map(r => r.productId);
			const beanIds = result.filter(r => r.type==='bean').map(r => r.productId);
			if (ramIds.length) {
				const [rams] = await db.query(`SELECT id, name FROM rams WHERE id IN (${ramIds.map(()=>'?').join(',')})`, ramIds);
				const map = Object.fromEntries(rams.map(x => [String(x.id), x.name]));
				for (const r of result) if (r.type==='ram') r.name = map[r.productId] || '';
			}
			if (beanIds.length) {
				const [beans] = await db.query(`SELECT id, name FROM beans WHERE id IN (${beanIds.map(()=>'?').join(',')})`, beanIds);
				const map = Object.fromEntries(beans.map(x => [String(x.id), x.name]));
				for (const r of result) if (r.type==='bean') r.name = map[r.productId] || '';
			}
			return sendJson(res, 200, result);
		}
		const rams = readJson('rams.json');
		const beans = readJson('beans.json');
		const movements = readJson('stock_movements.json');
		const source = type === 'ram' ? rams : type === 'bean' ? beans : rams.concat(beans.map(b => ({...b, type: 'bean'})));
		const byId = {};
		for (const p of source) byId[p.id] = { productId: p.id, name: p.name, type: type || (p.breed ? 'ram' : 'bean'), stock: 0 };
		for (const m of movements) {
			if (type && m.productType !== type) continue;
			if (!byId[m.productId]) continue;
			byId[m.productId].stock += Number(m.quantityChange || 0);
		}
		return sendJson(res, 200, Object.values(byId));
	}

	// --- Admin: Settings ---
	if (req.url === '/api/admin/settings' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, phone, email, location, created_at AS createdAt, updated_at AS updatedAt FROM settings WHERE id=1');
			return sendJson(res, 200, rows[0] || {});
		}
		return sendJson(res, 200, readJsonObject('settings.json'));
	}
	if (req.url === '/api/admin/settings' && req.method === 'PUT') {
		try {
			const body = await parseBody(req);
			const db = await getDb();
			if (db) {
				await db.execute('INSERT INTO settings (id, phone, email, location) VALUES (1,?,?,?) ON DUPLICATE KEY UPDATE phone=VALUES(phone), email=VALUES(email), location=VALUES(location)', [body.phone||null, body.email||null, body.location||null]);
				logActivity('update', 'settings', 'settings', body);
				return sendJson(res, 200, { ok: true });
			}
			writeJsonObject('settings.json', { ...readJsonObject('settings.json'), ...body, updatedAt: new Date().toISOString() });
			logActivity('update', 'settings', 'settings', body);
			return sendJson(res, 200, { ok: true });
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}

	// --- Admin: Logs & Reports ---
	if (req.url === '/api/admin/logs' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [rows] = await db.query('SELECT id, actor_user_id AS actorUserId, actor_name AS actorName, action, entity, entity_id AS entityId, details, created_at AS createdAt FROM activity_logs ORDER BY created_at DESC LIMIT 200');
			return sendJson(res, 200, rows.map(r => ({ ...r, id: String(r.id) })));
		}
		return sendJson(res, 200, readJson('activity_logs.json'));
	}
	if (req.url === '/api/admin/reports/overview' && req.method === 'GET') {
		const db = await getDb();
		if (db) {
			const [[{ totalUsers }]] = await db.query('SELECT COUNT(*) AS totalUsers FROM users');
			const [usersByType] = await db.query('SELECT user_type AS type, COUNT(*) AS count FROM users GROUP BY user_type');
			const [[{ totalOrders, revenue }]] = await db.query('SELECT COUNT(*) AS totalOrders, COALESCE(SUM(total_amount),0) AS revenue FROM orders');
			const [ordersByStatus] = await db.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
			const [monthly] = await db.query("SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue FROM orders GROUP BY DATE_FORMAT(created_at,'%Y-%m') ORDER BY month DESC");
			const [[{ inquiriesTotal }]] = await db.query('SELECT COUNT(*) AS inquiriesTotal FROM inquiries');
			const [[{ stockKeys }]] = await db.query('SELECT COUNT(*) AS stockKeys FROM (SELECT product_type, product_id FROM stock_movements GROUP BY product_type, product_id) t');
			const byType = usersByType.reduce((acc, r) => { acc[r.type||'unknown'] = Number(r.count||0); return acc; }, {});
			const byStatus = ordersByStatus.reduce((acc, r) => { acc[r.status||'pending'] = Number(r.count||0); return acc; }, {});
			return sendJson(res, 200, { users: { total: Number(totalUsers||0), byType }, orders: { total: Number(totalOrders||0), byStatus, revenue: Number(revenue||0) }, inquiries: { total: Number(inquiriesTotal||0) }, growth: monthly, stockKeys: Number(stockKeys||0) });
		}
		const users = readJson('users.json');
		const orders = readJson('orders.json');
		const inquiries = readJson('inquiries.json');
		const movements = readJson('stock_movements.json');
		const byType = users.reduce((acc,u)=>{ acc[u.type||'unknown']=(acc[u.type||'unknown']||0)+1; return acc; },{});
		const orderByStatus = orders.reduce((acc,o)=>{ acc[o.status||'pending']=(acc[o.status||'pending']||0)+1; return acc; },{});
		const revenue = orders.reduce((sum,o)=> sum + Number(o.totalAmount||0), 0);
		const monthly = {};
		for (const o of orders) {
			const d = new Date(o.createdAt || Date.now());
			const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
			if (!monthly[key]) monthly[key] = { month: key, orders: 0, revenue: 0 };
			monthly[key].orders += 1;
			monthly[key].revenue += Number(o.totalAmount||0);
		}
		const stockTotals = movements.reduce((acc,m)=>{ const key = `${m.productType}:${m.productId}`; acc[key]=(acc[key]||0)+Number(m.quantityChange||0); return acc; },{});
		return sendJson(res, 200, { users: { total: users.length, byType }, orders: { total: orders.length, byStatus: orderByStatus, revenue }, inquiries: { total: inquiries.length }, growth: Object.values(monthly), stockKeys: Object.keys(stockTotals).length });
	}

	return serveStatic(req, res);
};

ensureDirs();

// Ensure uploads is accessible as static
const originalServeStatic = serveStatic;

// Create a simple server
function logActivity(action, entity, entityId, details) {
	try {
		(async () => {
			const db = await getDb();
			if (db) {
				await db.execute('INSERT INTO activity_logs (actor_user_id, actor_name, action, entity, entity_id, details) VALUES (?,?,?,?,?,?)', [null, 'admin', action, entity, String(entityId), JSON.stringify(details || {})]);
				return;
			}
			const logs = readJson('activity_logs.json');
			logs.push({ id: Date.now().toString(), createdAt: new Date().toISOString(), actor: 'admin', action, entity, entityId, details });
			writeJson('activity_logs.json', logs);
		})();
	} catch (e) {}
}

const server = http.createServer((req, res) => {
	// Serve uploaded files directly
	if (req.url.startsWith('/uploads/')) {
		const file = req.url.replace('/uploads/', '');
		const resolved = path.join(UPLOADS_DIR, file);
		fs.stat(resolved, (err, stat) => {
			if (err || !stat.isFile()) {
				res.writeHead(404); return res.end('Not found');
			}
			const ext = path.extname(resolved).toLowerCase();
			const map = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
			res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
			fs.createReadStream(resolved).pipe(res);
		});
		return;
	}

	routes(req, res);
});

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

