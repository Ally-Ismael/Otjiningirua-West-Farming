import os
from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    jsonify,
    current_app,
)
from flask_login import login_user, logout_user, login_required
from werkzeug.utils import secure_filename
from ..models import User, Product, Media, Inquiry, AnalyticsEvent
from ...extensions import db


admin_bp = Blueprint('admin', __name__, template_folder='../../templates')


@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('admin.dashboard'))
        flash('Invalid credentials', 'danger')
    return render_template('admin/login.html')


@admin_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('admin.login'))


@admin_bp.route('/')
@login_required
def dashboard():
    products_count = Product.query.count()
    inquiries_count = Inquiry.query.count()
    return render_template(
        'admin/dashboard.html',
        products_count=products_count,
        inquiries_count=inquiries_count,
    )


@admin_bp.route('/products')
@login_required
def products():
    products = Product.query.order_by(Product.created_at.desc()).all()
    return render_template('admin/products.html', products=products)


@admin_bp.route('/products/new', methods=['GET', 'POST'])
@login_required
def new_product():
    if request.method == 'POST':
        product = Product(
            name=request.form.get('name'),
            description=request.form.get('description'),
            category=request.form.get('category'),
            price=float(request.form.get('price') or 0),
        )
        db.session.add(product)
        db.session.commit()
        return redirect(url_for('admin.products'))
    return render_template('admin/new_product.html')


@admin_bp.route('/products/<int:product_id>/upload', methods=['POST'])
@login_required
def upload_media(product_id: int):
    product = Product.query.get_or_404(product_id)
    file = request.files.get('file')
    media_type = request.form.get('media_type', 'video')
    if not file:
        return jsonify({'error': 'No file'}), 400
    filename = secure_filename(file.filename)
    upload_dir = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    file.save(file_path)
    rel_path = os.path.relpath(
        file_path, os.path.join(current_app.root_path, 'src', 'static')
    )
    media = Media(
        product_id=product.id, media_type=media_type, file_path=rel_path
    )
    db.session.add(media)
    db.session.commit()
    return redirect(url_for('admin.products'))


@admin_bp.route('/inquiries')
@login_required
def show_inquiries():
    inquiries = Inquiry.query.order_by(Inquiry.created_at.desc()).all()
    return render_template('admin/inquiries.html', inquiries=inquiries)


@admin_bp.route('/analytics')
@login_required
def analytics():
    events = AnalyticsEvent.query.order_by(AnalyticsEvent.created_at.desc()).limit(500).all()
    return render_template('admin/analytics.html', events=events)

