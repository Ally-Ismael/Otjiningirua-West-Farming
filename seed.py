from otjiningirua import create_app
from otjiningirua.src.models import Product
from otjiningirua.extensions import db

app = create_app()
with app.app_context():
    if Product.query.count() == 0:
        db.session.add_all([
            Product(name='Dorper Ram A', description='Strong genetics, 2 years old.', category='ram', price=8000.0),
            Product(name='Dorper Ram B', description='Healthy, well-conditioned.', category='ram', price=7800.0),
            Product(name='Pinto Beans - 50kg', description='Fresh harvest.', category='bean', price=900.0),
            Product(name='Red Kidney Beans - 50kg', description='Premium quality.', category='bean', price=950.0),
        ])
        db.session.commit()
        print('Seeded sample products.')
    else:
        print('Products already seeded.')

