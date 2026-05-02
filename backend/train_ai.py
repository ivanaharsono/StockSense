import pandas as pd
from sqlalchemy import create_engine
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

# ─── 1. KONEKSI KE DATABASE ──────────────────────────────────────────
DATABASE_URL = "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense"
engine = create_engine(DATABASE_URL)

print("⏳ Mengambil data dari PostgreSQL...")
df = pd.read_sql("SELECT * FROM products", engine)

# ─── 💡 JURUS 1: FEATURE ENGINEERING ─────────────────────────────────
print("⚙️ Meracik rumus rahasia (Feature Engineering)...")
# Rumus pintar: Sisa hari sebelum stok habis = Stok saat ini / Permintaan harian
# Ditambah 0.1 biar program nggak error gara-gara pembagian dengan nol
df['days_of_stock'] = df['current_stock'] / (df['daily_demand'] + 0.1)

# Fitur yang dipakai AI sekarang nambah satu yang paling kuat!
features = [
    'current_stock', 
    'daily_demand', 
    'lead_time_days', 
    'supplier_reliability_score', 
    'promotion_active', 
    'weather_impact',
    'days_of_stock' # <--- Fitur baru kita
]

data = df[features + ['stockout_risk']].copy()

# Encoding teks ke angka
data['promotion_active'] = data['promotion_active'].map({'Yes': 1, 'No': 0})
data['weather_impact'] = data['weather_impact'].map({'Low': 0, 'Medium': 1, 'High': 2})
data['stockout_risk'] = data['stockout_risk'].map({'Yes': 1, 'No': 0})
data = data.dropna()

# ─── 3. BAGI DATA ────────────────────────────────────────────────────
X = data.drop('stockout_risk', axis=1)
y = data['stockout_risk']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# ─── 💡 JURUS 2: MODEL TUNING & BALANCING ────────────────────────────
print("🧠 Melatih AI versi Pro (Hyperparameter Tuning)...")
model = RandomForestClassifier(
    n_estimators=200,          # Tambah jumlah "pohon" keputusan jadi 200 biar lebih teliti
    max_depth=12,              # Batasi kedalaman mikir biar nggak over-thinking (overfitting)
    class_weight='balanced',   # Paksa AI perhatikan data produk yang stockout-nya "Yes"
    random_state=42
)
model.fit(X_train, y_train)

# ─── 5. UJI KEPINTARAN ───────────────────────────────────────────────
y_pred = model.predict(X_test)
akurasi = accuracy_score(y_test, y_pred)
print("="*50)
print(f"🔥 BINGO! Akurasi AI kita meroket jadi: {akurasi * 100:.2f}%")
print("="*50)

# ─── 6. SIMPAN OTAK AI BARU ──────────────────────────────────────────
joblib.dump(model, 'ai_model.pkl')
print("✅ Otak AI (Versi Upgrade) berhasil disimpan!")