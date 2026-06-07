import os
import json
import joblib
import io
import pandas as pd
import numpy as np
from datetime import date
from dotenv import load_dotenv
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Response, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, func, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from groq import Groq
from fastapi.responses import StreamingResponse

load_dotenv()

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── SQLAlchemy Model ──────────────────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"
    id                         = Column(Integer, primary_key=True, index=True)
    product_id                 = Column(String, index=True)
    date                       = Column(String)
    store_id                   = Column(String)
    current_stock              = Column(Integer)
    daily_demand               = Column(Integer)
    lead_time_days             = Column(Integer)
    supplier_reliability_score = Column(Float)
    promotion_active           = Column(String)
    weather_impact             = Column(String)
    stockout_risk              = Column(String)
    extra_data                 = Column(Text)   # kolom custom dari Excel, disimpan sebagai JSON string

Base.metadata.create_all(bind=engine)

# Auto-migrate: tambah kolom extra_data kalau DB lama belum punya (aman dijalankan berkali-kali)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS extra_data TEXT"))
        conn.commit()
except Exception as e:
    print(f"⚠️ Migrasi extra_data dilewati: {e}")

# Kolom yang dianggap "standar" (dipakai AI & dashboard). Sisanya = kolom custom.
STANDARD_COLS = {
    "product_id", "date", "store_id", "current_stock", "daily_demand",
    "lead_time_days", "supplier_reliability_score", "promotion_active",
    "weather_impact", "stockout_risk",
}

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="StockSense API", version="1.1.0")

# ─── Load ML Model ────────────────────────────────────────────────────────────
try:
    ml_model = joblib.load("ai_model.pkl")
    print("✅ ML model berhasil dimuat!")
except Exception as e:
    print(f"⚠️ Gagal memuat ML model: {e}")
    ml_model = None

# ─── Groq AI ──────────────────────────────────────────────────────────────────
try:
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    print("✅ Groq AI siap!")
except Exception as e:
    print(f"⚠️ Gagal init Groq: {e}")
    groq_client = None

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Dependency ───────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Schemas ──────────────────────────────────────────────────────────────────
class ProductCreate(BaseModel):
    product_id:                 str
    store_id:                   str
    current_stock:              int
    daily_demand:               int
    date:                       Optional[str]   = None
    lead_time_days:             Optional[int]   = 3
    supplier_reliability_score: Optional[float] = 80.0
    promotion_active:           Optional[str]   = "No"
    weather_impact:             Optional[str]   = "Low"
    stockout_risk:              Optional[str]   = "No"

class ProductUpdate(BaseModel):
    current_stock:              Optional[int]   = None
    daily_demand:               Optional[int]   = None
    lead_time_days:             Optional[int]   = None
    supplier_reliability_score: Optional[float] = None
    promotion_active:           Optional[str]   = None
    weather_impact:             Optional[str]   = None
    stockout_risk:              Optional[str]   = None

class ChatRequest(BaseModel):
    message: str

# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "StockSense API is running!", "version": "1.1.0"}

# ─── Helper konversi nilai dari Excel (tahan NaN & tipe numpy) ────────────────
def safe_int(v, d=0):
    try:
        if pd.isna(v): return d
        return int(float(v))
    except Exception:
        return d

def safe_float(v, d=0.0):
    try:
        if pd.isna(v): return d
        return float(v)
    except Exception:
        return d

def safe_str(v, d=""):
    try:
        if pd.isna(v): return d
        return str(v)
    except Exception:
        return d

def clean_extra_value(v):
    """Ubah nilai numpy/NaN jadi tipe Python biasa supaya bisa di-JSON-kan."""
    if pd.isna(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return str(v)

# ─── Helper functions (bukan endpoint) ────────────────────────────────────────
def run_stockout_prediction(payload) -> str:
    # Rule-based safety net — override ML kalau kondisi jelas kritis
    days_of_stock = payload.current_stock / (payload.daily_demand + 0.1)
    if days_of_stock <= payload.lead_time_days:
        return "Yes"  # stok tidak cukup sampai barang datang = pasti risk
    
    if ml_model is None:
        return "No"
    try:
        promo_map   = {"Yes": 1, "No": 0}
        weather_map = {"Low": 0, "Medium": 1, "High": 2}
        days_of_stock = payload.current_stock / (payload.daily_demand + 0.1)
        input_data = pd.DataFrame([{
            "current_stock":              payload.current_stock,
            "daily_demand":               payload.daily_demand,
            "lead_time_days":             payload.lead_time_days,
            "supplier_reliability_score": payload.supplier_reliability_score,
            "promotion_active":           promo_map.get(payload.promotion_active, 0),
            "weather_impact":             weather_map.get(payload.weather_impact, 0),
            "days_of_stock":              days_of_stock,
        }])
        pred = ml_model.predict(input_data)[0]
        return "Yes" if pred == 1 else "No"
    except Exception:
        return "No"


def product_to_dict(p: Product) -> dict:
    # extra_data (JSON string) → dict; kolom custom dikirim NESTED supaya frontend tahu mana yang custom
    extra = {}
    if p.extra_data:
        try:
            parsed = json.loads(p.extra_data)
            if isinstance(parsed, dict):
                extra = parsed
        except Exception:
            extra = {}
    return {
        "id":                         p.id,
        "product_id":                 p.product_id,
        "date":                       p.date,
        "store_id":                   p.store_id,
        "current_stock":              p.current_stock,
        "daily_demand":               p.daily_demand,
        "lead_time_days":             p.lead_time_days,
        "supplier_reliability_score": p.supplier_reliability_score,
        "promotion_active":           p.promotion_active,
        "weather_impact":             p.weather_impact,
        "stockout_risk":              p.stockout_risk,
        "extra_data":                 extra,
    }

# ─── PRODUCTS ─────────────────────────────────────────────────────────────────
@app.get("/products")
def get_products(
    db:               Session = Depends(get_db),
    skip:             int     = Query(0, ge=0),
    limit:            int     = Query(200, le=100000000),
    store_id:         Optional[str] = None,
    stockout_risk:    Optional[str] = None,
    weather_impact:   Optional[str] = None,
    promotion_active: Optional[str] = None,
    search:           Optional[str] = None,
):
    query = db.query(Product)
    if store_id:         query = query.filter(Product.store_id == store_id)
    if stockout_risk:    query = query.filter(Product.stockout_risk == stockout_risk)
    if weather_impact:   query = query.filter(Product.weather_impact == weather_impact)
    if promotion_active: query = query.filter(Product.promotion_active == promotion_active)
    if search:
        query = query.filter(
            Product.product_id.ilike(f"%{search}%") |
            Product.store_id.ilike(f"%{search}%")
        )
    total    = query.count()
    products = query.offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit,
            "data": [product_to_dict(p) for p in products]}


@app.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_dict(product)


@app.post("/products")
def upsert_product(payload: ProductCreate, response: Response, db: Session = Depends(get_db)):
    p_id = payload.product_id.upper().strip()
    if not p_id:
        raise HTTPException(status_code=400, detail="Product ID tidak boleh kosong!")

    product_date   = payload.date or str(date.today())
    predicted_risk = run_stockout_prediction(payload)
    existing       = db.query(Product).filter(Product.product_id == p_id).first()

    if existing:
        # NOTE: extra_data SENGAJA tidak diutak-atik di sini supaya kolom custom tidak hilang saat update via form
        existing.store_id                   = payload.store_id
        existing.current_stock              = payload.current_stock
        existing.daily_demand               = payload.daily_demand
        existing.lead_time_days             = payload.lead_time_days
        existing.supplier_reliability_score = payload.supplier_reliability_score
        existing.promotion_active           = payload.promotion_active
        existing.weather_impact             = payload.weather_impact
        existing.stockout_risk              = predicted_risk
        db.commit()
        db.refresh(existing)
        response.status_code = 200
        return {"status": "updated", "message": f"Produk {p_id} berhasil diperbarui!", "data": product_to_dict(existing)}

    product = Product(
        product_id=p_id, date=product_date, store_id=payload.store_id,
        current_stock=payload.current_stock, daily_demand=payload.daily_demand,
        lead_time_days=payload.lead_time_days,
        supplier_reliability_score=payload.supplier_reliability_score,
        promotion_active=payload.promotion_active,
        weather_impact=payload.weather_impact, stockout_risk=predicted_risk,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    response.status_code = 201
    return {"status": "created", "message": f"Produk {p_id} baru berhasil ditambahkan!", "data": product_to_dict(product)}


@app.put("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product_to_dict(product)


@app.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return {"message": f"Product {product_id} deleted"}

# ─── TEMPLATE DOWNLOAD ────────────────────────────────────────────────────────
@app.get("/download-template")
def download_template():
    """Excel template kosong + 1 baris contoh. Kolom standar wajib; kolom lain bebas ditambah user."""
    df = pd.DataFrame([{
        "product_id": "P001", "date": "2024-01-01", "store_id": "S1",
        "current_stock": 100, "daily_demand": 20, "lead_time_days": 3,
        "supplier_reliability_score": 85.0, "promotion_active": "No",
        "weather_impact": "Low", "stockout_risk": "No",
        # contoh kolom custom (boleh dihapus / diganti sesuka user)
        "kategori": "Minuman", "harga": 15000, "supplier_name": "PT Contoh",
    }])
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
    output.seek(0)
    headers = {"Content-Disposition": "attachment; filename=template_stocksense.xlsx"}
    return StreamingResponse(
        output, headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

# ─── UPLOAD & EXPORT ──────────────────────────────────────────────────────────
@app.post("/upload-data")
async def upload_excel_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Format harus .csv atau .xlsx")

        # Wajib minimal punya product_id
        if "product_id" not in df.columns:
            raise HTTPException(status_code=400, detail="Kolom 'product_id' wajib ada di file.")

        db.query(Product).delete()

        inserted = 0
        for _, row in df.iterrows():
            row_dict = row.to_dict()

            # Pisahkan kolom custom (yang BUKAN kolom standar)
            extra = {}
            for col, val in row_dict.items():
                if col not in STANDARD_COLS:
                    cleaned = clean_extra_value(val)
                    if cleaned is not None:
                        extra[str(col)] = cleaned

            db.add(Product(
                product_id                 = safe_str(row_dict.get("product_id")),
                date                       = safe_str(row_dict.get("date"), "2024-01-01"),
                store_id                   = safe_str(row_dict.get("store_id"), "S1"),
                current_stock              = safe_int(row_dict.get("current_stock")),
                daily_demand               = safe_int(row_dict.get("daily_demand")),
                lead_time_days             = safe_int(row_dict.get("lead_time_days"), 3),
                supplier_reliability_score = safe_float(row_dict.get("supplier_reliability_score"), 80.0),
                promotion_active           = safe_str(row_dict.get("promotion_active"), "No"),
                weather_impact             = safe_str(row_dict.get("weather_impact"), "Low"),
                stockout_risk              = safe_str(row_dict.get("stockout_risk"), "No"),
                extra_data                 = json.dumps(extra, ensure_ascii=False) if extra else None,
            ))
            inserted += 1

        db.commit()
        extra_cols = [c for c in df.columns if c not in STANDARD_COLS]
        msg = f"Berhasil memasukkan {inserted} data produk!"
        if extra_cols:
            msg += f" ({len(extra_cols)} kolom custom terdeteksi: {', '.join(extra_cols)})"
        return {"status": "success", "message": msg, "custom_columns": extra_cols}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export-data")
def export_to_excel(filename: Optional[str] = Query(None), db: Session = Depends(get_db)):
    try:
        products = db.query(Product).order_by(Product.product_id).all()

        # Flatten: kolom custom dispread jadi kolom Excel biasa
        rows = []
        for p in products:
            d = product_to_dict(p)
            extra = d.pop("extra_data", {}) or {}
            d.pop("id", None)
            d.update(extra)
            rows.append(d)
        df = pd.DataFrame(rows)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Updated Inventory')
        output.seek(0)

        if filename:
            base        = filename.rsplit('.', 1)[0]
            export_name = f"{base}_updated.xlsx"
        else:
            export_name = "stock_updated.xlsx"

        headers = {"Content-Disposition": f"attachment; filename={export_name}"}
        return StreamingResponse(
            output, headers=headers,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── DASHBOARD ────────────────────────────────────────────────────────────────
@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        total_products = db.query(Product).count()
        avg_demand     = float(db.query(func.avg(Product.daily_demand)).scalar() or 0)
        avg_supplier   = float(db.query(func.avg(Product.supplier_reliability_score)).scalar() or 0)
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
        high_risk      = db.query(Product).filter(Product.stockout_risk == "Yes").limit(10).all()
        low_risk       = db.query(Product).filter(
            Product.current_stock > (Product.daily_demand * Product.lead_time_days)
        ).limit(10).all()

        def fmt(p):
            return {
                "product_id": p.product_id, "store_id": p.store_id,
                "current_stock": p.current_stock, "daily_demand": p.daily_demand,
                "lead_time_days": p.lead_time_days, "stockout_risk": p.stockout_risk,
                "promotion_active": p.promotion_active,
            }

        return {
            "total_products":      total_products,
            "avg_daily_demand":    round(avg_demand, 1),
            "avg_supplier_score":  round(avg_supplier, 1),
            "stockout_risk_count": stockout_count,
            "high_risk_products":  [fmt(p) for p in high_risk],
            "low_risk_products":   [fmt(p) for p in low_risk],
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

# ─── ANALYTICS ────────────────────────────────────────────────────────────────
@app.get("/analytics/stores")
def get_store_performance(db: Session = Depends(get_db)):
    stores = db.query(Product.store_id).distinct().all()
    result = []
    for (store_id,) in stores:
        total        = db.query(Product).filter(Product.store_id == store_id).count()
        stockout     = db.query(Product).filter(Product.store_id == store_id, Product.stockout_risk == "Yes").count()
        avg_demand   = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id).scalar() or 0)
        avg_stock    = float(db.query(func.avg(Product.current_stock)).filter(Product.store_id == store_id).scalar() or 0)
        promo_demand = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id, Product.promotion_active == "Yes").scalar() or 0)
        no_promo     = float(db.query(func.avg(Product.daily_demand)).filter(Product.store_id == store_id, Product.promotion_active == "No").scalar() or 0)
        result.append({
            "store_id":       store_id,
            "total_products": total,
            "stockout_count": stockout,
            "stockout_rate":  round((stockout / total * 100) if total > 0 else 0, 1),
            "avg_demand":     round(avg_demand, 1),
            "avg_stock":      round(avg_stock, 1),
            "promoD":         round(promo_demand, 1),
            "noPromoD":       round(no_promo, 1),
        })
    return sorted(result, key=lambda x: x["stockout_rate"], reverse=True)


@app.get("/analytics/weather")
def get_weather_impact(db: Session = Depends(get_db)):
    result = []
    for level in ["Low", "Medium", "High"]:
        total    = db.query(Product).filter(Product.weather_impact.ilike(f"%{level}%")).count()
        stockout = db.query(Product).filter(
            Product.weather_impact.ilike(f"%{level}%"),
            Product.stockout_risk.ilike("%Yes%"),
        ).count()
        result.append({
            "weather":      level,
            "total":        total,
            "high":         stockout,
            "low":          total - stockout,
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
            "store_id":             r.store_id,
            "avg_reliability_score": round(float(r.avg_score or 0), 1),
            "avg_lead_time_days":   round(float(r.avg_lead_time or 0), 1),
        }
        for r in results
    ]

# ─── ML PREDICTION ────────────────────────────────────────────────────────────
@app.get("/ai/predict/{product_id}")
def predict_stockout(product_id: str, db: Session = Depends(get_db)):
    if ml_model is None:
        raise HTTPException(status_code=500, detail="ML model not loaded")
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    promo_map   = {"Yes": 1, "No": 0}
    weather_map = {"Low": 0, "Medium": 1, "High": 2}
    days_of_stock = product.current_stock / (product.daily_demand + 0.1)
    input_data = pd.DataFrame([{
        "current_stock":              product.current_stock,
        "daily_demand":               product.daily_demand,
        "lead_time_days":             product.lead_time_days,
        "supplier_reliability_score": product.supplier_reliability_score,
        "promotion_active":           promo_map.get(product.promotion_active, 0),
        "weather_impact":             weather_map.get(product.weather_impact, 0),
        "days_of_stock":              days_of_stock,
    }])

    prediction  = ml_model.predict(input_data)[0]
    probability = ml_model.predict_proba(input_data)[0][1]
    return {
        "product_id":              product.product_id,
        "ai_prediction":           "Yes" if prediction == 1 else "No",
        "risk_probability_percent": round(probability * 100, 1),
        "ai_insight": (
            "⚠️ Peringatan: Barang ini berisiko tinggi habis, segera re-stok!"
            if prediction == 1 else "✅ Stok masih aman terkendali."
        ),
    }


@app.post("/ai/retrain")
def retrain_model(db: Session = Depends(get_db)):
    global ml_model
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score

        products = db.query(Product).all()
        if len(products) < 10:
            raise HTTPException(status_code=400, detail="Data kurang dari 10 baris.")

        df = pd.DataFrame([{
            "current_stock":              p.current_stock,
            "daily_demand":               p.daily_demand,
            "lead_time_days":             p.lead_time_days,
            "supplier_reliability_score": p.supplier_reliability_score,
            "promotion_active":           1 if p.promotion_active == "Yes" else 0,
            "weather_impact":             {"Low": 0, "Medium": 1, "High": 2}.get(p.weather_impact, 0),
            "days_of_stock":              p.current_stock / (p.daily_demand + 0.1),
            "stockout_risk":              1 if p.stockout_risk == "Yes" else 0,
        } for p in products])

        X, y = df.drop(columns=["stockout_risk"]), df["stockout_risk"]
        if y.nunique() < 2:
            raise HTTPException(status_code=400, detail="Data harus punya 'Yes' DAN 'No' untuk training.")

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        new_model = RandomForestClassifier(n_estimators=100, random_state=42)
        new_model.fit(X_train, y_train)

        accuracy = round(accuracy_score(y_test, new_model.predict(X_test)) * 100, 2)
        joblib.dump(new_model, "ai_model.pkl")
        ml_model = new_model

        return {
            "status":        "success",
            "message":       f"Model berhasil dilatih ulang dengan {len(products)} data!",
            "accuracy":      f"{accuracy}%",
            "total_data":    len(products),
            "training_data": len(X_train),
            "test_data":     len(X_test),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

# ─── GROQ AI CHAT ─────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    if groq_client is None:
        raise HTTPException(status_code=500, detail="Groq AI tidak tersedia.")
    try:
        total          = db.query(Product).count()
        stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
        avg_demand     = float(db.query(func.avg(Product.daily_demand)).scalar() or 0)

        system_prompt = (
            f"Kamu adalah StockSense AI, asisten inventory cerdas. "
            f"Data real-time: {total} produk, {stockout_count} berisiko stockout, "
            f"avg demand {round(avg_demand,1)}/hari. "
            f"Jawab singkat dalam Bahasa Indonesia, maksimal 3 kalimat."
        )
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": request.message},
            ],
            max_tokens=200, temperature=0.5,
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/ai-analyze")
async def analyze_stock(db: Session = Depends(get_db)):
    if groq_client is None:
        raise HTTPException(status_code=500, detail="Groq AI tidak tersedia")
    stockout_count = db.query(Product).filter(Product.stockout_risk == "Yes").count()
    total          = db.query(Product).count()
    response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "Kamu asisten inventory profesional. Jawab dalam Bahasa Indonesia, singkat 2-3 kalimat."},
            {"role": "user",   "content": f"Saya punya {total} produk, {stockout_count} berisiko stockout. Beri analisa dan rekomendasi singkat."},
        ],
        max_tokens=200, temperature=0.5,
    )
    return {"status": "success", "ai_suggestion": response.choices[0].message.content}