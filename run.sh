#!/usr/bin/env bash
set -euo pipefail

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || true

export FLASK_APP=otjiningirua:create_app
export FLASK_ENV=development

flask db init || true
flask db migrate -m "init" || true
flask db upgrade

python - <<'PY'
from otjiningirua import create_app
from otjiningirua.src.models import User
from otjiningirua.extensions import db

app = create_app()
with app.app_context():
    if not User.query.filter_by(email='admin@example.com').first():
        u = User(email='admin@example.com')
        u.set_password('admin123')
        db.session.add(u)
        db.session.commit()
        print('Created default admin: admin@example.com / admin123')
    else:
        print('Admin user already exists')
PY

flask run --host=0.0.0.0 --port=8000

