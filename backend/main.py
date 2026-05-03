import os
import joblib
import pandas as pd
import numpy as np
from datetime import date
from dotenv import load_dotenv
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from groq import Groq

load_dotenv()

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL = "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── SQLAlchemy Model ─────────────────────────────────────────────────────────
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

# ─── Load ML Model ───────────────────────────────────────────────────────────
try:
    ml_model = joblib.load("ai_model.pkl")
    print("✅ ML model berhasil dimuat!")
except Exception as e:
    print(f"⚠️ Gagal memuat ML model: {e}")
    ml_model = None

# ─── Groq AI ─────────────────────────────────────────────────────────────────
try:
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    print("✅ Groq AI siap!")
except Exception as e:
    print(f"⚠️ Gagal init Groq: {e}")
    groq_client = None

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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

# ─── Schemas ─────────────────────────────────────────────────────────────────

# POST /products — cuma 4 field wajib, sisanya optional dengan default
class ProductCreate(BaseModel):
    product_id: str
    store_id: str
    current_stock: int
    daily_demand: int
    date: Optional[str] = None
    lead_time_days: Optional[int] = 3
    supplier_reliability_score: Optional[float] = 80.0
    promotion_active: Optional[str] = "No"
    weather_impact: Optional[str] = "Low"
    stockout_risk: Optional[str] = "No"

class ProductUpdate(BaseModel):
    current_stock: Optional[int] = None
    daily_demand: Optional[int] = None
    lead_time_days: Optional[int] = None
    supplier_reliability_score: Optional[float] = None
    promotion_active: Optional[str] = None
    weather_impact: Optional[str] = None
    stockout_risk: Optional[str] = None

class ChatRequest(BaseModel):
    message: str

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
    # Auto tanggal hari ini kalau ga dikirim
    product_date = payload.date or str(date.today())

    # Prediksi stockout otomatis pakai ML model kalau ada
    predicted_risk = payload.stockout_risk
    if ml_model is not None:
        try:
            promo_map = {"Yes": 1, "No": 0}
            weather_map = {"Low": 0, "Medium": 1, "High": 2}
            days_of_stock = payload.current_stock / (payload.daily_demand + 0.1)
            input_data = pd.DataFrame([{
                "current_stock": payload.current_stock,
                "daily_demand": payload.daily_demand,
                "lead_time_days": payload.lead_time_days,
                "supplier_reliability_score": payload.supplier_reliability_score,
                "promotion_active": promo_map.get(payload.promotion_active, 0),
                "weather_impact": weather_map.get(payload.weather_impact, 0),
                "days_of_stock": days_of_stock,
            }])
            prediction = ml_model.predict(input_data)[0]
            predicted_risk = "Yes" if prediction == 1 else "No"
        except Exception:
            pass

    product = Product(
        product_id=payload.product_id,
        date=product_date,
        store_id=payload.store_id,
        current_stock=payload.current_stock,
        daily_demand=payload.daily_demand,
        lead_time_days=payload.lead_time_days,
        supplier_reliability_score=payload.supplier_reliability_score,
        promotion_active=payload.promotion_active,
        weather_impact=payload.weather_impact,
        stockout_risk=predicted_risk,
    )
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
        avg_demand = float(db.query(func.avg(Product.daily_demand)).scalar() or 0)
        avg_supplier = float(db.query(func.avg(Product.supplier_reliability_score)).scalar() or 0)
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
        high_risk = db.query(Product).filter(Product.stockout_risk == "Yes").limit(10).all()

        return {
            "total_products": total_products,
            "avg_daily_demand": round(avg_demand, 1),
            "avg_supplier_score": round(avg_supplier, 1),
            "stockout_risk_count": stockout_count,
            "high_risk_products": [
                {
                    "product_id": p.product_id,
                    "store_id": p.store_id,
                    "current_stock": p.current_stock,
                    "daily_demand": p.daily_demand,
                    "lead_time_days": p.lead_time_days,
                    "stockout_risk": p.stockout_risk,
                    "promotion_active": p.promotion_active,
                }
                for p in high_risk
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/trend")
def get_demand_trend(db: Session = Depends(get_db)):
    try:
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
        raise HTTPException(status_code=500, detail=str(e))

# ─── ANALYTICS ───────────────────────────────────────────────────────────────
@app.get("/analytics/stores")
def get_store_performance(db: Session = Depends(get_db)):
    stores = db.query(Product.store_id).distinct().all()
    result = []
    for (store_id,) in stores:
        total = db.query(Product).filter(Product.store_id == store_id).count()
        stockout = db.query(Product).filter(Product.store_id == store_id, Product.stockout_risk == "Yes").count()
        avg_demand = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id).scalar() or 0)
        avg_stock = float(db.query(func.avg(Product.current_stock)).filter(Product.store_id == store_id).scalar() or 0)
        promo_demand = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id, Product.promotion_active == "Yes").scalar() or 0)
        no_promo_demand = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id, Product.promotion_active == "No").scalar() or 0)
        result.append({
            "store_id": store_id,
            "total_products": total,
            "stockout_count": stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
            "avg_demand": round(avg_demand, 1),
            "avg_stock": round(avg_stock, 1),
            "promoD": round(promo_demand, 1),
            "noPromoD": round(no_promo_demand, 1),
        })
    return sorted(result, key=lambda x: x["stockout_rate"], reverse=True)


@app.get("/analytics/weather")
def get_weather_impact(db: Session = Depends(get_db)):
    result = []
    weather_levels = ["Low", "Medium", "High"]
    for level in ["Low", "Medium", "High"]:
        total = db.query(Product).filter(Product.weather_impact.ilike(f"%{level}%")).count()
        stockout = db.query(Product).filter(
            Product.weather_impact.ilike(f"%{level}%"), 
            Product.stockout_risk.ilike("%Yes%") 
        ).count()
        
        result.append({
            "weather": level,
            "total": total,
            "High risk": stockout,
            "Low risk": total - stockout,
            "high": stockout,
            "low": total - stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
        })
    return result


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
            "avg_reliability_score": round(float(r.avg_score or 0), 1),
            "avg_lead_time_days": round(float(r.avg_lead_time or 0), 1),
        }
        for r in results
    ]

# ─── ML PREDICTION ───────────────────────────────────────────────────────────
@app.get("/ai/predict/{product_id}")
def predict_stockout(product_id: str, db: Session = Depends(get_db)):
    if ml_model is None:
        raise HTTPException(status_code=500, detail="ML model not loaded")

    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    promo_map = {"Yes": 1, "No": 0}
    weather_map = {"Low": 0, "Medium": 1, "High": 2}
    days_of_stock = product.current_stock / (product.daily_demand + 0.1)

    input_data = pd.DataFrame([{
        "current_stock": product.current_stock,
        "daily_demand": product.daily_demand,
        "lead_time_days": product.lead_time_days,
        "supplier_reliability_score": product.supplier_reliability_score,
        "promotion_active": promo_map.get(product.promotion_active, 0),
        "weather_impact": weather_map.get(product.weather_impact, 0),
        "days_of_stock": days_of_stock,
    }])

    prediction = ml_model.predict(input_data)[0]
    probability = ml_model.predict_proba(input_data)[0][1]

    return {
        "product_id": product.product_id,
        "ai_prediction": "Yes" if prediction == 1 else "No",
        "risk_probability_percent": round(probability * 100, 1),
        "ai_insight": (
            "⚠️ Peringatan: Barang ini berisiko tinggi habis, segera re-stok!"
            if prediction == 1
            else "✅ Stok masih aman terkendali."
        ),
    }

# ─── GROQ AI CHAT ─────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    if groq_client is None:
        raise HTTPException(status_code=500, detail="Groq AI tidak tersedia. Cek GROQ_API_KEY di .env")
    try:
        total = db.query(Product).count()
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
        avg_demand = float(db.query(func.avg(Product.daily_demand)).scalar() or 0)

        system_prompt = f"""Kamu adalah StockSense AI, asisten inventory cerdas.
Data real-time: {total} produk, {stockout_count} berisiko stockout, avg demand {round(avg_demand,1)}/hari.
Jawab singkat dalam Bahasa Indonesia, maksimal 3 kalimat."""

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            max_tokens=200,
            temperature=0.5,
        )

        reply = response.choices[0].message.content
        print(f"✅ Groq jawab: {reply[:50]}")
        return {"status": "success", "reply": reply}

    except Exception as e:
        print(f"❌ ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analyze")
async def analyze_stock(db: Session = Depends(get_db)):
    if groq_client is None:
        raise HTTPException(status_code=500, detail="Groq AI tidak tersedia")

    stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
    total = db.query(Product).count()

    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "Kamu asisten inventory profesional. Jawab dalam Bahasa Indonesia, singkat 2-3 kalimat."},
            {"role": "user", "content": f"Saya punya {total} produk, {stockout_count} berisiko stockout. Beri analisa dan rekomendasi singkat."}
        ],
        max_tokens=200,
        temperature=0.5,
    )

    return {"status": "success", "ai_suggestion": response.choices[0].message.content}