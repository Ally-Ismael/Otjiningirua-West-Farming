from flask import Blueprint, render_template, request, jsonify
from sqlalchemy import desc
from ..models import Product, Inquiry, AnalyticsEvent
from ...extensions import db


public_bp = Blueprint('public', __name__)


@public_bp.route('/')
def home():
    rams = (
        Product.query.filter_by(category='ram', is_active=True)
        .order_by(desc(Product.created_at))
        .limit(6)
        .all()
    )
    beans = (
        Product.query.filter_by(category='bean', is_active=True)
        .order_by(desc(Product.created_at))
        .limit(6)
        .all()
    )
    return render_template('home.html', rams=rams, beans=beans)


@public_bp.route('/product/<int:product_id>')
def product_detail(product_id: int):
    product = Product.query.get_or_404(product_id)
    return render_template('product_detail.html', product=product)


@public_bp.route('/inquiry', methods=['POST'])
def create_inquiry():
    data = request.get_json() or request.form
    inquiry = Inquiry(
        product_id=data.get('product_id'),
        name=data.get('name'),
        email=data.get('email'),
        phone=data.get('phone'),
        message=data.get('message'),
    )
    db.session.add(inquiry)
    db.session.commit()
    return jsonify({'ok': True})


@public_bp.route('/analytics', methods=['POST'])
def track_analytics():
    data = request.get_json() or {}
    event = AnalyticsEvent(
        event_name=data.get('event_name'),
        path=data.get('path'),
        metadata=str(data.get('metadata')),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify({'ok': True})

