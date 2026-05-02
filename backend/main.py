import os
import joblib
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel


import google.generativeai as genai

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

# ─── Gemini AI ───────────────────────────────────────────────────────────────
try:
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    gemini = genai.GenerativeModel("gemini-2.0-flash-lite",
    generation_config=genai.GenerationConfig(
        max_output_tokens=200,
        temperature=0.5,
    )
)
    print("✅ Gemini AI siap!")
except Exception as e:
    print(f"⚠️ Gagal init Gemini: {e}")
    gemini = None

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

# Bikin cetakan datanya
class ProductInput(BaseModel):
    product_id: str
    store_id: str
    current_stock: int
    daily_demand: int

@app.post("/products")
async def add_product(prod: ProductInput):
    df = pd.read_csv("data_stok.csv")
    
    # Bikin baris data baru (Risk sama Supplier kita kasih default dulu)
    new_data = {
        "product_id": prod.product_id,
        "store_id": prod.store_id,
        "current_stock": prod.current_stock,
        "daily_demand": prod.daily_demand,
        "stockout_risk": "No", 
        "supplier_reliability_score": 80 
    }
    
    # Masukin ke dataframe terus save nimpa CSV lama
    df = pd.concat([df, pd.DataFrame([new_data])], ignore_index=True)
    df.to_csv("data_stok.csv", index=False)
    
    return {"message": "Mantap, produk masuk!"}

# ─── DASHBOARD ───────────────────────────────────────────────────────────────
# HAPUS TULISAN /api DI BARIS INI:
@app.get("/dashboard/stats") 
async def get_dashboard_stats():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        
        # Pisahin 10 data High Risk dan 10 data Safe Stocks
        high_risk = df[df["stockout_risk"] == "Yes"].head(10).fillna("").to_dict(orient="records")
        low_risk = df[df["stockout_risk"] == "No"].head(10).fillna("").to_dict(orient="records")
        
        return {
            "total_products": len(df),
            "avg_daily_demand": int(df["daily_demand"].mean()),
            "stockout_risk_count": len(df[df["stockout_risk"] == "Yes"]),
            "avg_supplier_score": round(df["supplier_reliability_score"].mean(), 1),
            "high_risk_products": high_risk,
            "low_risk_products": low_risk  
        }
    except Exception as e:
        print("Error stats:", e)
        return {}

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
        result.append({
            "store_id": store_id,
            "total_products": total,
            "stockout_count": stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
            "avg_demand": round(avg_demand, 1),
            "avg_stock": round(avg_stock, 1),
        })
    return sorted(result, key=lambda x: x["stockout_rate"], reverse=True)


@app.get("/analytics/weather")
def get_weather_impact(db: Session = Depends(get_db)):
    result = []
    for level in ["Low", "Medium", "High"]:
        total = db.query(Product).filter(Product.weather_impact == level).count()
        stockout = db.query(Product).filter(Product.weather_impact == level, Product.stockout_risk == "Yes").count()
        result.append({
            "weather": level,
            "total": total,
            "stockout": stockout,
            "safe": total - stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
        })
    return result

# --- ENDPOINTS KHUSUS UNTUK ANALYTICS ---

@app.get("/api/stores")
async def get_api_stores():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        return df["store_id"].dropna().unique().tolist()
    except:
        return []

@app.get("/api/store-data")
async def get_api_store_data():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        store_data = {}
        for store in df["store_id"].dropna().unique():
            store_df = df[df["store_id"] == store]
            
            total_items = len(store_df)
            high_risk = len(store_df[store_df["stockout_risk"] == "Yes"]) 
            rate = round((high_risk / total_items) * 100, 1) if total_items > 0 else 0
            
            store_data[store] = {
                "promoD": int(store_df[store_df["promotion_active"] == "Yes"]["daily_demand"].sum()),
                "noPromoD": int(store_df[store_df["promotion_active"] == "No"]["daily_demand"].sum()),
                "avgDemand": int(store_df["daily_demand"].mean()) if not pd.isna(store_df["daily_demand"].mean()) else 0,
                "avgStock": int(store_df["current_stock"].mean()) if not pd.isna(store_df["current_stock"].mean()) else 0,
                "stockoutRate": rate
            }
        return store_data
    except Exception as e:
        print(f"Error store-data: {e}")
        return {}

@app.get("/api/weather-risk")
async def get_api_weather_risk():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        weather_data = []
        # Kita paksa urutannya dari Low ke High biar rapi
        for w in ["Low", "Medium", "High"]: 
            w_df = df[df["weather_impact"] == w]
            weather_data.append({
                "weather": w,
                "high": len(w_df[w_df["stockout_risk"] == "Yes"]),
                "medium": 0,
                "low": len(w_df[w_df["stockout_risk"] == "No"])
            })
        return weather_data
    except Exception as e:
        print(f"Error weather: {e}")
        return []

@app.get("/api/suppliers")
async def get_api_suppliers():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        return [
            {"name": "Supplier Utama", "score": int(df["supplier_reliability_score"].max())},
            {"name": "Supplier Cadangan", "score": int(df["supplier_reliability_score"].mean())},
            {"name": "Supplier Lokal", "score": int(df["supplier_reliability_score"].min())}
        ]
    except:
        return []

@app.get("/api/trend")
async def get_api_trend():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        trend = []
        if "date" in df.columns:
            grouped = df.groupby("date").agg({"current_stock": "sum", "daily_demand": "sum"}).reset_index()
            grouped = grouped.sort_values("date")
            for _, row in grouped.tail(30).iterrows(): 
                trend.append({
                    "date": str(row["date"]),
                    "stock": int(row["current_stock"]),
                    "demand": int(row["daily_demand"])
                })
        return trend
    except:
        return []
    
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

# ─── GEMINI AI CHAT ───────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        total = db.query(Product).count()
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
        avg_demand = float(db.query(func.avg(Product.daily_demand)).scalar() or 0)

        system_context = f"""
Kamu adalah StockSense AI, asisten inventory.
Data saat ini: {total} produk, {stockout_count} berisiko stockout, avg demand {round(avg_demand,1)}/hari.
Jawab singkat dalam Bahasa Indonesia, maksimal 3 kalimat.
"""
        full_prompt = f"{system_context}\nUser: {request.message}"
        
        print(f"🔍 Ngirim ke Gemini: {request.message}")
        response = gemini.generate_content(full_prompt)
        print(f"✅ Gemini jawab: {response.text[:50]}")

        return {"status": "success", "reply": response.text}

    except Exception as e:
        print(f"❌ ERROR DETAIL: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analyze")
async def analyze_stock(db: Session = Depends(get_db)):
    if gemini is None:
        raise HTTPException(status_code=500, detail="Gemini AI tidak tersedia")

    stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
    total = db.query(Product).count()

    prompt = f"""
Saya punya data inventory dengan {total} produk, dan {stockout_count} diantaranya berisiko stockout.
Berikan analisa singkat 2-3 kalimat dan rekomendasi tindakan sebagai asisten inventaris profesional.
Jawab dalam Bahasa Indonesia.
"""
    response = gemini.generate_content(prompt)
    return {"status": "success", "ai_suggestion": response.text}

import pandas as pd

# Tambahkan ini di bawah endpoint yang udah ada di main.py
@app.get("/api/products")
@app.get("/products") 
async def get_all_products():
    try:
        import pandas as pd
        df = pd.read_csv("data_stok.csv")
        # Kirim semua data buat ditampilin di tabel page Products
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        print("Error fetch products:", e)
        return []