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

const sendJson = (res, status, obj) => {
	res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
	res.end(JSON.stringify(obj));
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
			return sendJson(res, 201, ram);
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}
	if (req.url === '/api/admin/beans' && req.method === 'POST') {
		try {
			const body = await parseBody(req);
			const beans = readJson('beans.json');
			const bean = { id: Date.now().toString(), createdAt: new Date().toISOString(), media: [], ...body };
			beans.push(bean);
			writeJson('beans.json', beans);
			return sendJson(res, 201, bean);
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
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
				}
			}
			if (parentType === 'bean') {
				const beans = readJson('beans.json');
				const idx = beans.findIndex(b => b.id === parentId);
				if (idx >= 0) {
					beans[idx].media = beans[idx].media || [];
					beans[idx].media.push({ type: 'video', url: publicUrl, filename: safeName });
					writeJson('beans.json', beans);
				}
			}
			return sendJson(res, 201, { ok: true, url: publicUrl });
		} catch (e) {
			return sendJson(res, 400, { ok: false, error: e.message });
		}
	}

	return serveStatic(req, res);
};

ensureDirs();

// Ensure uploads is accessible as static
const originalServeStatic = serveStatic;

// Create a simple server
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

