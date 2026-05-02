from sqlalchemy import create_engine, text

# Koneksi ke database kamu
DATABASE_URL = "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense"
engine = create_engine(DATABASE_URL)

print("⏳ Merombak data acak menjadi data logis...")

with engine.begin() as conn: # .begin() biar otomatis ter-save (commit)
    # 1. Reset semuanya jadi 'No' dulu
    conn.execute(text("UPDATE products SET stockout_risk = 'No';"))
    
    # 2. Masukkan Logika Bisnis Asli
    # Barang berisiko 'Yes' JIKA stoknya lebih sedikit dari (demand * lead_time)
    # Ditambah efek Promo: Kalau promo aktif, risiko barang habis lebih cepat (dikali 1.5)
    conn.execute(text("""
        UPDATE products 
        SET stockout_risk = 'Yes' 
        WHERE current_stock <= (
            daily_demand * lead_time_days * 
            CASE WHEN promotion_active = 'Yes' THEN 1.5 ELSE 1.1 END
        );
    """))

print("✅ Data berhasil diperbaiki! Sekarang datanya punya pola sebab-akibat yang jelas.")