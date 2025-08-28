from flask import Flask
from .extensions import db, migrate, login_manager
from flask_cors import CORS
import os


def create_app() -> Flask:
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder='src/static',
        template_folder='src/templates',
    )
    # Load from environment if python-dotenv is available
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except Exception:
        pass
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///otjiningirua.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'src', 'static', 'uploads', 'videos')
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    CORS(app)
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    login_manager.login_view = "admin.login"

    from .src.models import User  # noqa: F401

    @login_manager.user_loader
    def load_user(user_id: str):
        from .src.models import User as UserModel
        return UserModel.query.get(int(user_id))

    from .src.routes.public import public_bp
    from .src.routes.admin import admin_bp
    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp, url_prefix='/admin')

    @app.context_processor
    def inject_settings():
        return {
            'WHATSAPP_NUMBER': os.environ.get('WHATSAPP_NUMBER', '264811234567')
        }

    return app

