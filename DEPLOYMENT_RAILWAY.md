# Deploying to Railway

This project is ready for Railway (Node.js + MySQL). Follow this checklist to get a live URL with persistent media and a managed database.

## 1) Fork/Connect the repository
- Go to https://railway.app
- Create a New Project → Deploy from GitHub → select `Ally-Ismael/Otjiningirua-West-Farming`
- Railway detects Node.js and will run `npm install` and `npm start`

## 2) Configure the service
- Build/Start
  - Start command: `npm run start:production`
  - (Optional) Add environment variable: `NIXPACKS_NODE_VERSION=20`
- Port
  - The server reads `process.env.PORT` (Railway assigns one automatically)

## 3) Database (MySQL)
- In your Railway project, click New → Database → MySQL
- After provisioning, copy the connection details
- Add these variables to your Node service (Settings → Variables):
  - `NODE_ENV=production`
  - `ADMIN_USERNAME=admin@example.com`
  - `ADMIN_PASSWORD=<strong_password>`
  - `DB_HOST=<railway_mysql_host>`
  - `DB_PORT=<railway_mysql_port>`
  - `DB_USER=<railway_mysql_user>`
  - `DB_PASSWORD=<railway_mysql_password>`
  - `DB_NAME=<railway_mysql_db_name>`

### Import schema
- Download `db/schema.sql` from the repo
- Use MySQL Workbench/CLI to connect with the Railway DB credentials
- Run the script to create tables: rams, beans, media, inquiries, users, orders, stock_movements, settings, activity_logs

## 4) Media uploads (persistence)
Uploads are stored under `/uploads` via the `/api/admin/upload` endpoint. Since Railway's container FS is ephemeral, use one of these options:

- Option A: Railway Volume (recommended for simple setup)
  - Add a Volume to your Node service (e.g., mount at `/data`)
  - Add env var `UPLOADS_DIR=/data/uploads`
  - The server will create the directory on startup and serve `/uploads/*` from this path

- Option B: Cloudinary / S3 (recommended for video CDN/transcoding)
  - Set provider env vars (e.g., `CLOUDINARY_URL` or AWS credentials and `S3_BUCKET`)
  - Update the upload handler to send files to the provider and save returned URLs (open a task for this change)

For now, the code supports Option A out-of-the-box. See `.env.production.example` for a template.

## 5) Environment template
Use `.env.production.example` as a reference if you want to run locally in production mode:

```
NODE_ENV=production
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=change_me_strong_pw
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
UPLOADS_DIR=/data/uploads
```

## 6) First deploy and checks
- Trigger a deploy from Railway
- Open the live URL
- Verify endpoints:
  - `GET /api/rams` returns a JSON list
  - `GET /api/beans` returns a JSON list
  - Submit contact forms on `index.html` → should POST to `/api/inquiries`
  - Ensure an uploaded image/video appears under `/uploads/...`

## 7) Custom domain (optional)
- In the Node service → Settings → Domains → Add Custom Domain
- Follow Railway's DNS instructions (CNAME). HTTPS is automatic.

## 8) Security reminders
- Change `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Railway Variables
- Do not commit real credentials to the repo

## 9) Troubleshooting
- Database connection fails → the app falls back to JSON files. Verify DB variables and that the DB is ready.
- Uploads 404 → check the Volume is mounted and `UPLOADS_DIR` is set to the mounted path (e.g., `/data/uploads`).
- Large videos → consider Cloudinary/S3 for transcoding and CDN delivery.
