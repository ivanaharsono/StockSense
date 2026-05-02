import pandas as pd
from sqlalchemy import create_engine

# Gunakan alamat yang tadi sudah terbukti berhasil
DATABASE_URL = "postgresql://postgres:h4104ku1v4n4.0Tiga@localhost:5432/stocksense"
engine = create_engine(DATABASE_URL)

def pindahin_data():
    nama_file = "data_stok.csv" # GANTI SESUAI NAMA FILE KAMU
    
    print("Sedang membaca file... tunggu ya, Cuy.")
    
    # Kalau file kamu Excel (.xlsx), ganti jadi: pd.read_excel(nama_file)
    df = pd.read_csv(nama_file)
    
    # Bersihkan nama kolom (biar nggak ada spasi atau huruf kapital yang ganggu)
    df.columns = [c.lower().replace(' ', '_') for c in df.columns]

    print(f"Ketemu {len(df)} baris data. Gas kita pindahin ke PostgreSQL!")

    # 'if_exists=append' artinya data ditambahin ke tabel yang sudah ada
    # 'index=False' biar nomor baris di Excel nggak ikut jadi kolom
    df.to_sql('products', engine, if_exists='append', index=False)
    
    print("SELESAI! Sekarang datamu sudah aman di dalam 'kulkas' PostgreSQL.")

if __name__ == "__main__":
    pindahin_data()