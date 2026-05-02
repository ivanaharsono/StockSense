from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import Optional
import joblib
import pandas as pd

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL = "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── Model ───────────────────────────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, index=True)
    date = Column(String)
    store_id = Column(String)
    current_stock = Column(Integer)
    daily_demand = Column(Integer)
    lead_time_days = Column(Integer)
    supplier_reliability_score = Column(Float)
    promotion_active = Column(String)
    weather_impact = Column(String)
    stockout_risk = Column(String)

Base.metadata.create_all(bind=engine)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="StockSense API", version="1.0.0")

try:
    ai_model = joblib.load("ai_model.pkl")
    print("✅ Otak AI berhasil dimuat ke FastAPI!")
except Exception as e:
    print(f"⚠️ Gagal memuat model AI: {e}")
    ai_model = None

# CORS — biar frontend React bisa akses backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Buka gerbang buat semuanya
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Dependency ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Schemas (Pydantic) ───────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    product_id: str
    date: str
    store_id: str
    current_stock: int
    daily_demand: int
    lead_time_days: int
    supplier_reliability_score: float
    promotion_active: str
    weather_impact: str
    stockout_risk: str

class ProductUpdate(BaseModel):
    current_stock: Optional[int] = None
    daily_demand: Optional[int] = None
    lead_time_days: Optional[int] = None
    supplier_reliability_score: Optional[float] = None
    promotion_active: Optional[str] = None
    weather_impact: Optional[str] = None
    stockout_risk: Optional[str] = None

# ─── Root ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "StockSense API is running!", "version": "1.0.0"}

# ─── PRODUCTS ────────────────────────────────────────────────────────────────

@app.get("/products")
def get_products(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    store_id: Optional[str] = None,
    stockout_risk: Optional[str] = None,
    weather_impact: Optional[str] = None,
    promotion_active: Optional[str] = None,
    search: Optional[str] = None,
):
    query = db.query(Product)
    if store_id:
        query = query.filter(Product.store_id == store_id)
    if stockout_risk:
        query = query.filter(Product.stockout_risk == stockout_risk)
    if weather_impact:
        query = query.filter(Product.weather_impact == weather_impact)
    if promotion_active:
        query = query.filter(Product.promotion_active == promotion_active)
    if search:
        query = query.filter(
            Product.product_id.ilike(f"%{search}%") |
            Product.store_id.ilike(f"%{search}%")
        )
    total = query.count()
    products = query.offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit, "data": products}


@app.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.post("/products", status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@app.put("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@app.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": f"Product {product_id} deleted"}

# ─── DASHBOARD ───────────────────────────────────────────────────────────────

@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total_products = db.query(Product).count()
        
        # Cara lebih aman buat ngambil rata-rata biar nggak keselek data kosong
        avg_demand_val = db.query(func.avg(Product.daily_demand)).scalar()
        avg_demand = float(avg_demand_val) if avg_demand_val is not None else 0.0
        
        avg_supplier_val = db.query(func.avg(Product.supplier_reliability_score)).scalar()
        avg_supplier = float(avg_supplier_val) if avg_supplier_val is not None else 0.0
        
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()

        # Ambil data dari database
        high_risk_products = db.query(Product).filter(Product.stockout_risk == "Yes").limit(10).all()
        low_risk_products = db.query(Product).filter(Product.stockout_risk == 'No').limit(10).all()

        high_risk = []
        for p in high_risk_products:
            high_risk.append({
                "product_id": p.product_id,
                "store_id": p.store_id,
                "current_stock": p.current_stock,
                "daily_demand": p.daily_demand,
                "lead_time_days": p.lead_time_days,
                "stockout_risk": p.stockout_risk,
                "promotion_active": p.promotion_active
            })

        return {
            "total_products": total_products,
            "avg_daily_demand": round(avg_demand, 1),
            "avg_supplier_score": round(avg_supplier, 1),
            "stockout_risk_count": stockout_count,
            "high_risk_products": high_risk_products,
            "low_risk_products": low_risk_products,
        }
    except Exception as e:
        # Kalau masih error, dia bakal nulis alasan aslinya di browser!
        return {"ERROR_ASLINYA": str(e)}


@app.get("/dashboard/trend")
def get_demand_trend(db: Session = Depends(get_db)):
    try:
        # Group by date, get avg demand and avg stock
        results = (
            db.query(
                Product.date,
                func.avg(Product.daily_demand).label("avg_demand"),
                func.avg(Product.current_stock).label("avg_stock"),
            )
            .group_by(Product.date)
            .order_by(Product.date)
            .limit(30)
            .all()
        )
        return [
            {"date": r.date, "demand": round(float(r.avg_demand or 0), 1), "stock": round(float(r.avg_stock or 0), 1)}
            for r in results
        ]
    except Exception as e:
        return {"ERROR_ASLINYA": str(e)}

# ─── ANALYTICS ───────────────────────────────────────────────────────────────

@app.get("/analytics/stores")
def get_store_performance(db: Session = Depends(get_db)):
    stores = db.query(Product.store_id).distinct().all()
    result = []
    for (store_id,) in stores:
        store_products = db.query(Product).filter(Product.store_id == store_id)
        total = store_products.count()
        stockout = store_products.filter(Product.stockout_risk == "Yes").count()
        avg_demand = db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id).scalar() or 0
        avg_stock = db.query(func.avg(Product.current_stock)).filter(Product.store_id == store_id).scalar() or 0
        result.append({
            "store_id": store_id,
            "total_products": total,
            "stockout_count": stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
            "avg_demand": round(avg_demand, 1),
            "avg_stock": round(avg_stock, 1),
        })
    return sorted(result, key=lambda x: x["stockout_rate"], reverse=True)


@app.get("/analytics/suppliers")
def get_supplier_stats(db: Session = Depends(get_db)):
    results = (
        db.query(
            Product.store_id,
            func.avg(Product.supplier_reliability_score).label("avg_score"),
            func.avg(Product.lead_time_days).label("avg_lead_time"),
        )
        .group_by(Product.store_id)
        .order_by(func.avg(Product.supplier_reliability_score))
        .all()
    )
    return [
        {
            "store_id": r.store_id,
            "avg_reliability_score": round(r.avg_score, 1),
            "avg_lead_time_days": round(r.avg_lead_time, 1),
        }
        for r in results
    ]


@app.get("/analytics/weather")
def get_weather_impact(db: Session = Depends(get_db)):
    weather_levels = ["Low", "Medium", "High"]
    result = []
    for level in weather_levels:
        query = db.query(Product).filter(Product.weather_impact == level)
        total = query.count()
        stockout = query.filter(Product.stockout_risk == "Yes").count()
        result.append({
            "weather": level,
            "total": total,
            "stockout": stockout,
            "safe": total - stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
        })
    return result

# ─── AI PREDICTION ───────────────────────────────────────────────────────────

@app.get("/ai/predict/{product_id}")
def predict_stockout(product_id: str, db: Session = Depends(get_db)):
    try:
        if ai_model is None:
            raise HTTPException(status_code=500, detail="AI Model is not loaded")

        # 1. Cari produknya di database dulu
        product = db.query(Product).filter(Product.product_id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # 2. Siapkan data persis seperti saat latihan (ubah teks jadi angka)
        promo_map = {'Yes': 1, 'No': 0}
        weather_map = {'Low': 0, 'Medium': 1, 'High': 2}

        # 💡 RUMUS BARU: Jangan lupa hitung days_of_stock biar AI nggak ngamuk
        days_of_stock = product.current_stock / (product.daily_demand + 0.1)

        # Bikin dataframe 1 baris buat ditebak AI (Sekarang genap 7 fitur!)
        input_data = pd.DataFrame([{
            'current_stock': product.current_stock,
            'daily_demand': product.daily_demand,
            'lead_time_days': product.lead_time_days,
            'supplier_reliability_score': product.supplier_reliability_score,
            'promotion_active': promo_map.get(product.promotion_active, 0),
            'weather_impact': weather_map.get(product.weather_impact, 0),
            'days_of_stock': days_of_stock # <--- Ini yang tadi ketinggalan!
        }])

        # 3. Minta AI menebak
        prediction = ai_model.predict(input_data)[0]
        
        # Minta persentase risikonya (probability)
        probability = ai_model.predict_proba(input_data)[0][1] 

        return {
            "product_id": product.product_id,
            "ai_prediction": "Yes" if prediction == 1 else "No",
            "risk_probability_percent": round(probability * 100, 1),
            "ai_insight": "⚠️ Peringatan: Barang ini berisiko tinggi habis, segera re-stok!" if prediction == 1 else "✅ Stok masih aman terkendali."
        }
    except Exception as e:
        return {"ERROR_ASLINYA": str(e)}