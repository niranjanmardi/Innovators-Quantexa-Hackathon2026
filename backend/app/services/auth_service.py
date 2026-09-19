import sqlite3
import os
import datetime
from passlib.context import CryptContext
import jwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-quant-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "users.db")

class AuthService:
    def __init__(self):
        self.init_db()

    def init_db(self):
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    avatar_url TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def verify_password(self, plain_password, hashed_password):
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password):
        return pwd_context.hash(password)

    def get_user_by_username(self, username: str):
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            return cursor.fetchone()

    def get_user_by_email(self, email: str):
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            return cursor.fetchone()

    def create_user(self, email: str, username: str, password: str, avatar_url: str):
        if self.get_user_by_email(email):
            raise ValueError("Email already registered")
        if self.get_user_by_username(username):
            raise ValueError("Username already taken")
            
        hashed_password = self.get_password_hash(password)
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (email, username, password_hash, avatar_url)
                VALUES (?, ?, ?, ?)
            """, (email, username, hashed_password, avatar_url))
            conn.commit()
            return self.get_user_by_username(username)

    def authenticate_user(self, username: str, password: str):
        user = self.get_user_by_username(username)
        if not user:
            return False
        if not self.verify_password(password, user['password_hash']):
            return False
        return dict(user)

    def create_access_token(self, data: dict, expires_delta: datetime.timedelta = None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.datetime.utcnow() + expires_delta
        else:
            expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

auth_service = AuthService()
