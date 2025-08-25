const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname);
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

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
		return sendJson(res, 200, readJson('rams.json'));
	}
	if (req.url === '/api/beans' && req.method === 'GET') {
		return sendJson(res, 200, readJson('beans.json'));
	}
	if (req.url === '/api/inquiries' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const inquiries = readJson('inquiries.json');
			const inquiry = { id: Date.now().toString(), createdAt: new Date().toISOString(), ...body };
			inquiries.push(inquiry);
			writeJson('inquiries.json', inquiries);
			return sendJson(res, 201, { ok: true });
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}
	if (req.url === '/api/admin/rams' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
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
		const rams = readJson('rams.json');
		const next = rams.filter(r => r.id !== id);
		writeJson('rams.json', next);
		logActivity('delete', 'ram', id, {});
		return sendJson(res, 200, { ok: true });
	}
	if (req.url === '/api/admin/beans' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
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
		const beans = readJson('beans.json');
		const next = beans.filter(b => b.id !== id);
		writeJson('beans.json', next);
		logActivity('delete', 'bean', id, {});
		return sendJson(res, 200, { ok: true });
	}
	if (req.url.startsWith('/api/admin/upload') && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const { parentType, parentId, base64, filename } = body;
			if (!parentType || !parentId || !base64 || !filename) {
				return sendJson(res, 400, { ok: false, error: 'Missing fields' });
			}
			const buffer = Buffer.from(base64, 'base64');
			const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
			const outPath = path.join(UPLOADS_DIR, safeName);
			fs.writeFileSync(outPath, buffer);
			const publicUrl = `/uploads/${safeName}`;
			if (parentType === 'ram') {
				const rams = readJson('rams.json');
				const idx = rams.findIndex(r => r.id === parentId);
				if (idx >= 0) {
					rams[idx].media = rams[idx].media || [];
					rams[idx].media.push({ type: 'video', url: publicUrl, filename: safeName });
					writeJson('rams.json', rams);
					logActivity('upload', 'ram_media', parentId, { url: publicUrl, filename: safeName });
				}
			}
			if (parentType === 'bean') {
				const beans = readJson('beans.json');
				const idx = beans.findIndex(b => b.id === parentId);
				if (idx >= 0) {
					beans[idx].media = beans[idx].media || [];
					beans[idx].media.push({ type: 'video', url: publicUrl, filename: safeName });
					writeJson('beans.json', beans);
					logActivity('upload', 'bean_media', parentId, { url: publicUrl, filename: safeName });
				}
			}
			return sendJson(res, 201, { ok: true, url: publicUrl });
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}

	// --- Admin: Users CRUD ---
	if (req.url === '/api/admin/users' && req.method === 'GET') {
		return sendJson(res, 200, readJson('users.json'));
	}
	if (req.url === '/api/admin/users' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const users = readJson('users.json');
			const user = { id: Date.now().toString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...body };
			users.push(user);
			writeJson('users.json', users);
			logActivity('create', 'user', user.id, user);
			return sendJson(res, 201, user);
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}
	if (req.url.startsWith('/api/admin/users/') && req.method === 'PUT') {
		try {
			const id = req.url.split('/').pop();
			const body = await parseBody(req);
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
		const users = readJson('users.json');
		const next = users.filter(u => u.id !== id);
		writeJson('users.json', next);
		logActivity('delete', 'user', id, {});
		return sendJson(res, 200, { ok: true });
	}

	// --- Admin: Orders CRUD ---
	if (req.url === '/api/admin/orders' && req.method === 'GET') {
		return sendJson(res, 200, readJson('orders.json'));
	}
	if (req.url === '/api/admin/orders' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
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
		const orders = readJson('orders.json');
		const next = orders.filter(o => o.id !== id);
		writeJson('orders.json', next);
		logActivity('delete', 'order', id, {});
		return sendJson(res, 200, { ok: true });
	}

	// --- Admin: Stock movements & summary ---
	if (req.url === '/api/admin/stock/movements' && req.method === 'GET') {
		return sendJson(res, 200, readJson('stock_movements.json'));
	}
	if (req.url === '/api/admin/stock/movements' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
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
		return sendJson(res, 200, readJsonObject('settings.json'));
	}
	if (req.url === '/api/admin/settings' && req.method === 'PUT') {
		try {
			const body = await parseBody(req);
			writeJsonObject('settings.json', { ...readJsonObject('settings.json'), ...body, updatedAt: new Date().toISOString() });
			logActivity('update', 'settings', 'settings', body);
			return sendJson(res, 200, { ok: true });
		} catch (e) { return sendJson(res, 400, { ok: false, error: e.message }); }
	}

	// --- Admin: Logs & Reports ---
	if (req.url === '/api/admin/logs' && req.method === 'GET') {
		return sendJson(res, 200, readJson('activity_logs.json'));
	}
	if (req.url === '/api/admin/reports/overview' && req.method === 'GET') {
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
		const logs = readJson('activity_logs.json');
		logs.push({ id: Date.now().toString(), createdAt: new Date().toISOString(), actor: 'admin', action, entity, entityId, details });
		writeJson('activity_logs.json', logs);
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

