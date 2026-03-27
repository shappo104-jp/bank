import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("DATABASE_PATH", "/data/app.db")
if not os.path.exists("/data"):
    DB_PATH = "app.db"


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                amount INTEGER NOT NULL
            )
        """)
        cursor.execute("SELECT COUNT(*) FROM transactions")
        count = cursor.fetchone()[0]
        if count == 0:
            default_transactions = [
                ('1/05', 1, 5, '電話', 'ドコモケイタイ', -6692),
                ('12/29', 12, 29, 'カード', '', -434000),
                ('12/25', 12, 25, '振込2', 'カ）エヌイーエフコミュニケーシ', 442507),
                ('12/01', 12, 1, '電話', 'ドコモケイタイ', -6883),
                ('11/28', 11, 28, 'カード', '', -216000),
                ('11/27', 11, 27, '振込2', 'カ）エヌイーエフコミュニケーシ', 231338),
                ('10/31', 10, 31, '電話', 'ドコモケイタイ', -6863),
                ('10/30', 10, 30, 'カード', '', -183000),
                ('10/30', 10, 30, '振込2', 'カ）エヌイーエフコミュニケーシ', 189129),
            ]
            cursor.executemany(
                "INSERT INTO transactions (date, month, day, type, description, amount) VALUES (?, ?, ?, ?, ?, ?)",
                default_transactions
            )
        conn.commit()


init_db()


class TransactionCreate(BaseModel):
    date: str
    month: int
    day: int
    type: str
    description: str = ""
    amount: int


class TransactionResponse(BaseModel):
    id: int
    date: str
    month: int
    day: int
    type: str
    description: str
    amount: int


class BalanceResponse(BaseModel):
    balance: int
    base_balance: int
    adjustment: int


BASE_BALANCE = 4682


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/transactions", response_model=list[TransactionResponse])
async def get_transactions():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, date, month, day, type, description, amount FROM transactions")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO transactions (date, month, day, type, description, amount) VALUES (?, ?, ?, ?, ?, ?)",
            (transaction.date, transaction.month, transaction.day, transaction.type, transaction.description, transaction.amount)
        )
        conn.commit()
        new_id = cursor.lastrowid
        return {
            "id": new_id,
            "date": transaction.date,
            "month": transaction.month,
            "day": transaction.day,
            "type": transaction.type,
            "description": transaction.description,
            "amount": transaction.amount
        }


@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM transactions WHERE id = ?", (transaction_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Transaction not found")
        cursor.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))
        conn.commit()
        return {"status": "deleted", "id": transaction_id}


@app.get("/api/balance", response_model=BalanceResponse)
async def get_balance():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT SUM(amount) as total FROM transactions"
        )
        row = cursor.fetchone()
        adjustment = row["total"] if row["total"] is not None else 0
        return {
            "balance": BASE_BALANCE + adjustment,
            "base_balance": BASE_BALANCE,
            "adjustment": adjustment
        }


# Serve frontend static files
STATIC_DIR = Path(__file__).parent.parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        file_path = STATIC_DIR / path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
