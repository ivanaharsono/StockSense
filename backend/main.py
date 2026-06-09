import os
import json
import joblib
import io
import secrets
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from dotenv import load_dotenv
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query, Response, File, UploadFile, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, func, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from groq import Groq
from fastapi.responses import StreamingResponse

from passlib.context import CryptContext
from jose import jwt, JWTError

load_dotenv()

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ─── Auth config ──────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", "ganti-ini-di-production-ya-rahasia-banget")
ALGORITHM  = "HS256"
TOKEN_DAYS = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Models ───────────────────────────────────────────────────────────────────
class Product(Base):
    __tablename__ = "products"
    id                         = Column(Integer, primary_key=True, index=True)
    workspace_id               = Column(String, index=True)
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
    extra_data                 = Column(Text)

class User(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, index=True)
    name            = Column(String)
    hashed_password = Column(String)
    workspace_id    = Column(String, index=True)
    created_at      = Column(String)

Base.metadata.create_all(bind=engine)

# Auto-migrate kolom (aman dijalankan berkali-kali)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS extra_data TEXT"))
        conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS workspace_id TEXT"))
        conn.execute(text("UPDATE products SET workspace_id = 'default' WHERE workspace_id IS NULL"))
        conn.commit()
except Exception as e:
    print(f"⚠️ Migrasi dilewati: {e}")

STANDARD_COLS = {
    "product_id", "date", "store_id", "current_stock", "daily_demand",
    "lead_time_days", "supplier_reliability_score", "promotion_active",
    "weather_impact", "stockout_risk",
}

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="StockSense API", version="2.1.0")

# ─── Load base ML Model ───────────────────────────────────────────────────────
try:
    base_model = joblib.load("ai_model.pkl")
    print("✅ ML model berhasil dimuat!")
except Exception as e:
    print(f"⚠️ Gagal memuat ML model: {e}")
    base_model = None

ws_models = {}
def get_model_for(ws: str):
    return ws_models.get(ws, base_model)

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
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ─── Dependencies ─────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(workspace_id: str, email: str) -> str:
    payload = {
        "ws":    workspace_id,
        "email": email,
        "exp":   datetime.utcnow() + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_workspace(
    authorization:  Optional[str] = Header(default=None),
    x_workspace_id: Optional[str] = Header(default=None),
    ws:             Optional[str] = Query(default=None),
    token:          Optional[str] = Query(default=None),  # buat window.open (export)
) -> str:
    """
    Prioritas: JWT (login) > header workspace > query param.
    User login → workspace diambil dari token (gak bisa dipalsukan).
    User anonim → masih bisa pakai header workspace (mode lama).
    """
    raw = None
    if authorization and authorization.lower().startswith("bearer "):
        raw = authorization.split(" ", 1)[1].strip()
    elif token:
        raw = token
    if raw:
        try:
            payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
            return payload.get("ws") or "default"
        except JWTError:
            pass
    return (x_workspace_id or ws or "default").strip() or "default"

# ─── Schemas ──────────────────────────────────────────────────────────────────
class RegisterReq(BaseModel):
    email:    str
    password: str
    name:     Optional[str] = None

class LoginReq(BaseModel):
    email:    str
    password: str

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
    return {"message": "StockSense API is running!", "version": "2.1.0"}

# ─── AUTH ─────────────────────────────────────────────────────────────────────
@app.post("/auth/register")
def register(req: RegisterReq, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email tidak valid.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar.")

    workspace_id = "ws_" + secrets.token_hex(6)
    user = User(
        email=email,
        name=(req.name or email.split("@")[0]),
        hashed_password=pwd_context.hash(req.password),
        workspace_id=workspace_id,
        created_at=str(datetime.utcnow()),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(workspace_id, email)
    return {"token": token, "email": user.email, "name": user.name, "workspace_id": workspace_id}


@app.post("/auth/login")
def login(req: LoginReq, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user  = db.query(User).filter(User.email == email).first()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    token = create_token(user.workspace_id, user.email)
    return {"token": token, "email": user.email, "name": user.name, "workspace_id": user.workspace_id}


@app.get("/auth/me")
def get_me(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Belum login.")
    raw = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid / kedaluwarsa.")
    user = db.query(User).filter(User.email == payload.get("email")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")
    return {"email": user.email, "name": user.name, "workspace_id": user.workspace_id}

# ─── Helper konversi nilai Excel ──────────────────────────────────────────────
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
    if pd.isna(v):
        return None
    if isinstance(v, (np.integer,)):  return int(v)
    if isinstance(v, (np.floating,)): return float(v)
    if isinstance(v, (np.bool_,)):    return bool(v)
    return str(v)

# ─── ML prediction ────────────────────────────────────────────────────────────
def run_stockout_prediction(payload, ws: str) -> str:
    days_of_stock = payload.current_stock / (payload.daily_demand + 0.1)
    if days_of_stock <= payload.lead_time_days:
        return "Yes"
    model = get_model_for(ws)
    if model is None:
        return "No"
    try:
        promo_map   = {"Yes": 1, "No": 0}
        weather_map = {"Low": 0, "Medium": 1, "High": 2}
        input_data = pd.DataFrame([{
            "current_stock":              payload.current_stock,
            "daily_demand":               payload.daily_demand,
            "lead_time_days":             payload.lead_time_days,
            "supplier_reliability_score": payload.supplier_reliability_score,
            "promotion_active":           promo_map.get(payload.promotion_active, 0),
            "weather_impact":             weather_map.get(payload.weather_impact, 0),
            "days_of_stock":              days_of_stock,
        }])
        return "Yes" if model.predict(input_data)[0] == 1 else "No"
    except Exception:
        return "No"


def product_to_dict(p: Product) -> dict:
    extra = {}
    if p.extra_data:
        try:
            parsed = json.loads(p.extra_data)
            if isinstance(parsed, dict):
                extra = parsed
        except Exception:
            extra = {}
    return {
        "id": p.id, "product_id": p.product_id, "date": p.date, "store_id": p.store_id,
        "current_stock": p.current_stock, "daily_demand": p.daily_demand,
        "lead_time_days": p.lead_time_days, "supplier_reliability_score": p.supplier_reliability_score,
        "promotion_active": p.promotion_active, "weather_impact": p.weather_impact,
        "stockout_risk": p.stockout_risk, "extra_data": extra,
    }

# ─── PRODUCTS ─────────────────────────────────────────────────────────────────
@app.get("/products")
def get_products(
    db: Session = Depends(get_db), ws: str = Depends(get_workspace),
    skip: int = Query(0, ge=0), limit: int = Query(200, le=100000000),
    store_id: Optional[str] = None, stockout_risk: Optional[str] = None,
    weather_impact: Optional[str] = None, promotion_active: Optional[str] = None,
    search: Optional[str] = None,
):
    query = db.query(Product).filter(Product.workspace_id == ws)
    if store_id:         query = query.filter(Product.store_id == store_id)
    if stockout_risk:    query = query.filter(Product.stockout_risk == stockout_risk)
    if weather_impact:   query = query.filter(Product.weather_impact == weather_impact)
    if promotion_active: query = query.filter(Product.promotion_active == promotion_active)
    if search:
        query = query.filter(
            Product.product_id.ilike(f"%{search}%") | Product.store_id.ilike(f"%{search}%")
        )
    total    = query.count()
    products = query.offset(skip).limit(limit).all()
    return {"total": total, "skip": skip, "limit": limit,
            "data": [product_to_dict(p) for p in products]}


@app.get("/products/{product_id}")
def get_product(product_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    product = db.query(Product).filter(Product.workspace_id == ws, Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_to_dict(product)


@app.post("/products")
def upsert_product(payload: ProductCreate, response: Response,
                   db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    p_id = payload.product_id.upper().strip()
    if not p_id:
        raise HTTPException(status_code=400, detail="Product ID tidak boleh kosong!")
    product_date   = payload.date or str(date.today())
    predicted_risk = run_stockout_prediction(payload, ws)
    existing       = db.query(Product).filter(Product.workspace_id == ws, Product.product_id == p_id).first()

    if existing:
        existing.store_id                   = payload.store_id
        existing.current_stock              = payload.current_stock
        existing.daily_demand               = payload.daily_demand
        existing.lead_time_days             = payload.lead_time_days
        existing.supplier_reliability_score = payload.supplier_reliability_score
        existing.promotion_active           = payload.promotion_active
        existing.weather_impact             = payload.weather_impact
        existing.stockout_risk              = predicted_risk
        db.commit(); db.refresh(existing)
        response.status_code = 200
        return {"status": "updated", "message": f"Produk {p_id} berhasil diperbarui!", "data": product_to_dict(existing)}

    product = Product(
        workspace_id=ws, product_id=p_id, date=product_date, store_id=payload.store_id,
        current_stock=payload.current_stock, daily_demand=payload.daily_demand,
        lead_time_days=payload.lead_time_days, supplier_reliability_score=payload.supplier_reliability_score,
        promotion_active=payload.promotion_active, weather_impact=payload.weather_impact,
        stockout_risk=predicted_risk,
    )
    db.add(product); db.commit(); db.refresh(product)
    response.status_code = 201
    return {"status": "created", "message": f"Produk {p_id} baru berhasil ditambahkan!", "data": product_to_dict(product)}


@app.put("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate,
                   db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    product = db.query(Product).filter(Product.workspace_id == ws, Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, value in payload.dict(exclude_none=True).items():
        setattr(product, field, value)
    db.commit(); db.refresh(product)
    return product_to_dict(product)


@app.delete("/products/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    product = db.query(Product).filter(Product.workspace_id == ws, Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product); db.commit()
    return {"message": f"Product {product_id} deleted"}

# ─── TEMPLATE ─────────────────────────────────────────────────────────────────
@app.get("/download-template")
def download_template():
    df = pd.DataFrame([{
        "product_id": "P001", "date": "2024-01-01", "store_id": "S1",
        "current_stock": 100, "daily_demand": 20, "lead_time_days": 3,
        "supplier_reliability_score": 85.0, "promotion_active": "No",
        "weather_impact": "Low", "stockout_risk": "No",
        "kategori": "Minuman", "harga": 15000, "supplier_name": "PT Contoh",
    }])
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
    output.seek(0)
    return StreamingResponse(
        output, headers={"Content-Disposition": "attachment; filename=template_stocksense.xlsx"},
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

# ─── UPLOAD & EXPORT ──────────────────────────────────────────────────────────
@app.post("/upload-data")
async def upload_excel_csv(file: UploadFile = File(...),
                           db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Format harus .csv atau .xlsx")
        if "product_id" not in df.columns:
            raise HTTPException(status_code=400, detail="Kolom 'product_id' wajib ada di file.")

        db.query(Product).filter(Product.workspace_id == ws).delete()

        inserted = 0
        for _, row in df.iterrows():
            row_dict = row.to_dict()
            extra = {}
            for col, val in row_dict.items():
                if col not in STANDARD_COLS:
                    cleaned = clean_extra_value(val)
                    if cleaned is not None:
                        extra[str(col)] = cleaned
            db.add(Product(
                workspace_id               = ws,
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
            msg += f" ({len(extra_cols)} kolom custom: {', '.join(extra_cols)})"
        return {"status": "success", "message": msg, "custom_columns": extra_cols}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export-data")
def export_to_excel(filename: Optional[str] = Query(None),
                    db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    try:
        products = db.query(Product).filter(Product.workspace_id == ws).order_by(Product.product_id).all()
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
        export_name = f"{filename.rsplit('.',1)[0]}_updated.xlsx" if filename else "stock_updated.xlsx"
        return StreamingResponse(
            output, headers={"Content-Disposition": f"attachment; filename={export_name}"},
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── DASHBOARD ────────────────────────────────────────────────────────────────
@app.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    try:
        base = db.query(Product).filter(Product.workspace_id == ws)
        total_products = base.count()
        avg_demand     = float(db.query(func.avg(Product.daily_demand)).filter(Product.workspace_id == ws).scalar() or 0)
        avg_supplier   = float(db.query(func.avg(Product.supplier_reliability_score)).filter(Product.workspace_id == ws).scalar() or 0)
        stockout_count = base.filter(Product.stockout_risk == "Yes").count()
        high_risk      = base.filter(Product.stockout_risk == "Yes").limit(10).all()
        low_risk       = db.query(Product).filter(
            Product.workspace_id == ws,
            Product.current_stock > (Product.daily_demand * Product.lead_time_days)
        ).limit(10).all()

        def fmt(p):
            return {"product_id": p.product_id, "store_id": p.store_id,
                    "current_stock": p.current_stock, "daily_demand": p.daily_demand,
                    "lead_time_days": p.lead_time_days, "stockout_risk": p.stockout_risk,
                    "promotion_active": p.promotion_active}
        return {
            "total_products": total_products, "avg_daily_demand": round(avg_demand, 1),
            "avg_supplier_score": round(avg_supplier, 1), "stockout_risk_count": stockout_count,
            "high_risk_products": [fmt(p) for p in high_risk],
            "low_risk_products":  [fmt(p) for p in low_risk],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/dashboard/trend")
def get_demand_trend(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    try:
        results = (
            db.query(Product.date,
                     func.avg(Product.daily_demand).label("avg_demand"),
                     func.avg(Product.current_stock).label("avg_stock"))
            .filter(Product.workspace_id == ws)
            .group_by(Product.date).order_by(Product.date).limit(30).all()
        )
        return [{"date": r.date, "demand": round(float(r.avg_demand or 0), 1),
                 "stock": round(float(r.avg_stock or 0), 1)} for r in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── ANALYTICS ────────────────────────────────────────────────────────────────
@app.get("/analytics/stores")
def get_store_performance(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    stores = db.query(Product.store_id).filter(Product.workspace_id == ws).distinct().all()
    result = []
    for (store_id,) in stores:
        base = db.query(Product).filter(Product.workspace_id == ws, Product.store_id == store_id)
        total        = base.count()
        stockout     = base.filter(Product.stockout_risk == "Yes").count()
        avg_demand   = float(db.query(func.avg(Product.daily_demand)).filter(Product.workspace_id == ws, Product.store_id == store_id).scalar() or 0)
        avg_stock    = float(db.query(func.avg(Product.current_stock)).filter(Product.workspace_id == ws, Product.store_id == store_id).scalar() or 0)
        promo_demand = float(db.query(func.avg(Product.daily_demand)).filter(Product.workspace_id == ws, Product.store_id == store_id, Product.promotion_active == "Yes").scalar() or 0)
        no_promo     = float(db.query(func.avg(Product.daily_demand)).filter(Product.workspace_id == ws, Product.store_id == store_id, Product.promotion_active == "No").scalar() or 0)
        result.append({
            "store_id": store_id, "total_products": total, "stockout_count": stockout,
            "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1),
            "avg_demand": round(avg_demand, 1), "avg_stock": round(avg_stock, 1),
            "promoD": round(promo_demand, 1), "noPromoD": round(no_promo, 1),
        })
    return sorted(result, key=lambda x: x["stockout_rate"], reverse=True)


@app.get("/analytics/weather")
def get_weather_impact(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    result = []
    for level in ["Low", "Medium", "High"]:
        base = db.query(Product).filter(Product.workspace_id == ws, Product.weather_impact.ilike(f"%{level}%"))
        total    = base.count()
        stockout = base.filter(Product.stockout_risk.ilike("%Yes%")).count()
        result.append({"weather": level, "total": total, "high": stockout, "low": total - stockout,
                       "stockout_rate": round((stockout / total * 100) if total > 0 else 0, 1)})
    return result


@app.get("/analytics/suppliers")
def get_supplier_stats(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    results = (
        db.query(Product.store_id,
                 func.avg(Product.supplier_reliability_score).label("avg_score"),
                 func.avg(Product.lead_time_days).label("avg_lead_time"))
        .filter(Product.workspace_id == ws)
        .group_by(Product.store_id)
        .order_by(func.avg(Product.supplier_reliability_score)).all()
    )
    return [{"store_id": r.store_id,
             "avg_reliability_score": round(float(r.avg_score or 0), 1),
             "avg_lead_time_days": round(float(r.avg_lead_time or 0), 1)} for r in results]

# ─── ML PREDICTION ────────────────────────────────────────────────────────────
@app.get("/ai/predict/{product_id}")
def predict_stockout(product_id: str, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    product = db.query(Product).filter(Product.workspace_id == ws, Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    model = get_model_for(ws)
    days_of_stock = product.current_stock / (product.daily_demand + 0.1)
    if days_of_stock <= product.lead_time_days:
        return {"product_id": product.product_id, "ai_prediction": "Yes",
                "risk_probability_percent": 95.0,
                "ai_insight": "⚠️ Stok tidak cukup menutup lead time supplier — segera re-stok!"}
    if model is None:
        raise HTTPException(status_code=500, detail="ML model not loaded")
    promo_map   = {"Yes": 1, "No": 0}
    weather_map = {"Low": 0, "Medium": 1, "High": 2}
    input_data = pd.DataFrame([{
        "current_stock": product.current_stock, "daily_demand": product.daily_demand,
        "lead_time_days": product.lead_time_days, "supplier_reliability_score": product.supplier_reliability_score,
        "promotion_active": promo_map.get(product.promotion_active, 0),
        "weather_impact": weather_map.get(product.weather_impact, 0),
        "days_of_stock": days_of_stock,
    }])
    prediction  = model.predict(input_data)[0]
    probability = model.predict_proba(input_data)[0][1]
    return {"product_id": product.product_id,
            "ai_prediction": "Yes" if prediction == 1 else "No",
            "risk_probability_percent": round(probability * 100, 1),
            "ai_insight": ("⚠️ Peringatan: Barang ini berisiko tinggi habis, segera re-stok!"
                           if prediction == 1 else "✅ Stok masih aman terkendali.")}


@app.post("/ai/retrain")
def retrain_model(db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score
        products = db.query(Product).filter(Product.workspace_id == ws).all()
        if len(products) < 10:
            raise HTTPException(status_code=400, detail="Data kurang dari 10 baris.")
        df = pd.DataFrame([{
            "current_stock": p.current_stock, "daily_demand": p.daily_demand,
            "lead_time_days": p.lead_time_days, "supplier_reliability_score": p.supplier_reliability_score,
            "promotion_active": 1 if p.promotion_active == "Yes" else 0,
            "weather_impact": {"Low": 0, "Medium": 1, "High": 2}.get(p.weather_impact, 0),
            "days_of_stock": p.current_stock / (p.daily_demand + 0.1),
            "stockout_risk": 1 if p.stockout_risk == "Yes" else 0,
        } for p in products])
        X, y = df.drop(columns=["stockout_risk"]), df["stockout_risk"]
        if y.nunique() < 2:
            raise HTTPException(status_code=400, detail="Data harus punya 'Yes' DAN 'No' untuk training.")
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        new_model = RandomForestClassifier(n_estimators=100, random_state=42)
        new_model.fit(X_train, y_train)
        accuracy = round(accuracy_score(y_test, new_model.predict(X_test)) * 100, 2)
        ws_models[ws] = new_model
        return {"status": "success", "message": f"Model berhasil dilatih ulang dengan {len(products)} data!",
                "accuracy": f"{accuracy}%", "total_data": len(products),
                "training_data": len(X_train), "test_data": len(X_test)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training gagal: {str(e)}")

# ─── GROQ AI CHAT ─────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    if groq_client is None:
        raise HTTPException(status_code=500, detail="Groq AI tidak tersedia.")
    try:
        base = db.query(Product).filter(Product.workspace_id == ws)
        total          = base.count()
        stockout_count = base.filter(Product.stockout_risk == "Yes").count()
        avg_demand     = float(db.query(func.avg(Product.daily_demand)).filter(Product.workspace_id == ws).scalar() or 0)
        system_prompt = (
            f"Kamu adalah StockSense AI, asisten inventory cerdas. "
            f"Data real-time workspace ini: {total} produk, {stockout_count} berisiko stockout, "
            f"avg demand {round(avg_demand,1)}/hari. "
            f"Jawab singkat dalam Bahasa Indonesia, maksimal 3 kalimat."
        )
        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": request.message}],
            max_tokens=200, temperature=0.5,
        )
        return {"status": "success", "reply": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

        # ════════════════════════════════════════════════════════════════════════════
#  SMART UPLOAD — AI-assisted column mapping
#  Tempel blok ini di PALING BAWAH main.py.
#  Catatan: tambahkan `Form` ke import fastapi di atas, jadi:
#  from fastapi import FastAPI, Depends, HTTPException, Query, Response, File, UploadFile, Header, Form
# ════════════════════════════════════════════════════════════════════════════

TARGET_FIELDS = ["product_id", "store_id", "current_stock", "daily_demand",
                 "lead_time_days", "supplier_reliability_score"]

FIELD_ALIASES = {
    "product_id": ["product_id", "product id", "sku", "item id", "item_id", "kode", "id produk"],
    "store_id": ["store_id", "store", "branch", "cabang", "outlet", "toko", "warehouse", "gudang", "location", "lokasi"],
    "current_stock": ["current_stock", "stock quantity", "stock_quantity", "stock", "stok", "qty", "quantity", "inventory", "on hand", "jumlah"],
    "daily_demand": ["daily_demand", "demand", "sales", "sold", "quantity sold", "penjualan", "terjual", "permintaan"],
    "lead_time_days": ["lead_time_days", "lead time", "lead_time", "delivery time", "waktu kirim", "leadtime"],
    "supplier_reliability_score": ["supplier_reliability_score", "supplier score", "supplier", "reliability", "vendor", "skor supplier"],
}

def _read_upload(filename, contents):
    if filename.endswith(".csv"):
        return pd.read_csv(io.BytesIO(contents))
    if filename.endswith((".xls", ".xlsx")):
        return pd.read_excel(io.BytesIO(contents))
    raise HTTPException(status_code=400, detail="Format harus .csv atau .xlsx")

def heuristic_map(columns):
    """Nebak mapping dari kemiripan nama kolom (fallback / cadangan)."""
    mapping, used = {}, set()
    for field in TARGET_FIELDS:
        found = None
        for alias in FIELD_ALIASES[field]:
            for c in columns:
                if c in used:
                    continue
                cl = c.lower().strip()
                if alias == cl or alias in cl:
                    found = c
                    break
            if found:
                break
        if found:
            used.add(found)
        mapping[field] = found
    return mapping

def ai_map(columns, sample_rows):
    """Minta Groq nebak mapping. Kalau gagal, return None (nanti pakai heuristik)."""
    if groq_client is None:
        return None
    try:
        prompt = (
            "You map spreadsheet columns to inventory database fields. "
            f"Available columns: {columns}. "
            f"Sample rows: {json.dumps(sample_rows)[:1200]}. "
            f"Target fields: {TARGET_FIELDS}. "
            "Return ONLY a JSON object mapping each target field to the best matching "
            "column name from the available columns, or null if none fits. JSON only, no explanation."
        )
        resp = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300, temperature=0,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw[raw.find("{"): raw.rfind("}") + 1]
        parsed = json.loads(raw)
        clean = {}
        for f in TARGET_FIELDS:
            v = parsed.get(f)
            clean[f] = v if v in columns else None
        return clean
    except Exception as e:
        print(f"⚠️ AI map gagal, pakai heuristik: {e}")
        return None

def compute_risk(stock, demand, lead, supplier, promo, weather, ws):
    days = stock / (demand + 0.1)
    if days <= lead:
        return "Yes"
    model = get_model_for(ws)
    if model is None:
        return "No"
    try:
        pm = {"Yes": 1, "No": 0}; wm = {"Low": 0, "Medium": 1, "High": 2}
        X = pd.DataFrame([{
            "current_stock": stock, "daily_demand": demand, "lead_time_days": lead,
            "supplier_reliability_score": supplier,
            "promotion_active": pm.get(promo, 0), "weather_impact": wm.get(weather, 0),
            "days_of_stock": days,
        }])
        return "Yes" if model.predict(X)[0] == 1 else "No"
    except Exception:
        return "No"

@app.post("/upload/analyze")
async def upload_analyze(file: UploadFile = File(...), ws: str = Depends(get_workspace)):
    """Baca header + contoh baris, kembalikan tebakan mapping (AI → fallback heuristik)."""
    contents = await file.read()
    df = _read_upload(file.filename, contents)
    columns = [str(c) for c in df.columns]
    sample_rows = json.loads(df.head(3).astype(str).to_json(orient="records"))
    mapping = ai_map(columns, sample_rows) or heuristic_map(columns)
    return {"columns": columns, "sample_rows": sample_rows, "suggested_mapping": mapping}

@app.post("/upload/confirm")
async def upload_confirm(file: UploadFile = File(...), mapping: str = Form(...),
                         db: Session = Depends(get_db), ws: str = Depends(get_workspace)):
    """Masukkan data pakai mapping yang sudah dikonfirmasi user."""
    try:
        m = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="Mapping tidak valid.")
    if not m.get("product_id"):
        raise HTTPException(status_code=400, detail="Kolom Product ID wajib dipetakan.")

    contents = await file.read()
    df = _read_upload(file.filename, contents)
    mapped_sources = {v for v in m.values() if v}

    db.query(Product).filter(Product.workspace_id == ws).delete()

    inserted = 0
    for _, row in df.iterrows():
        rd = row.to_dict()

        def g(field, default, conv):
            col = m.get(field)
            if col and col in rd:
                return conv(rd[col], default)
            return default

        pid = safe_str(rd.get(m["product_id"])).upper().strip()
        if not pid:
            continue
        stock    = g("current_stock", 0, safe_int)
        demand   = g("daily_demand", 0, safe_int)
        lead     = g("lead_time_days", 3, safe_int)
        supplier = g("supplier_reliability_score", 80.0, safe_float)
        store    = g("store_id", "S1", safe_str)

        extra = {}
        for col, val in rd.items():
            if col not in mapped_sources:
                cv = clean_extra_value(val)
                if cv is not None:
                    extra[str(col)] = cv

        risk = compute_risk(stock, demand, lead, supplier, "No", "Low", ws)
        db.add(Product(
            workspace_id=ws, product_id=pid, date="2024-01-01", store_id=store,
            current_stock=stock, daily_demand=demand, lead_time_days=lead,
            supplier_reliability_score=supplier, promotion_active="No",
            weather_impact="Low", stockout_risk=risk,
            extra_data=json.dumps(extra, ensure_ascii=False) if extra else None,
        ))
        inserted += 1

    db.commit()
    unmapped = [str(c) for c in df.columns if c not in mapped_sources]
    return {"status": "success", "inserted": inserted,
            "message": f"Imported {inserted} products successfully.",
            "extra_columns": unmapped}