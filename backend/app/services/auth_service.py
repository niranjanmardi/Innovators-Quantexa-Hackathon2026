import sqlite3
import os
import datetime
import bcrypt
import jwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "super-secret-quant-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 1 week

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "users.db")

class AuthService:
    ACCESS_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES

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

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        try:
            pwd_bytes = plain_password.encode("utf-8")[:72]
            return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
        except Exception:
            return False

    def get_password_hash(self, password: str) -> str:
        pwd_bytes = password.encode("utf-8")[:72]
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

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

    def create_user(self, email: str, username: str, password: str, avatar_url: str = None):
        email = email.strip().lower()
        username = username.strip()
        if not email or "@" not in email:
            raise ValueError("A valid email address is required")
        if not username:
            raise ValueError("Username is required")
        if self.get_user_by_email(email):
            raise ValueError("Email already registered")
        if self.get_user_by_username(username):
            raise ValueError("Username already taken")
        if len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")
            
        hashed_password = self.get_password_hash(password)
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (email, username, password_hash, avatar_url)
                VALUES (?, ?, ?, ?)
            """, (email, username, hashed_password, avatar_url or ""))
            conn.commit()
            return self.get_user_by_username(username)

    def authenticate_user(self, username: str, password: str):
        username = username.strip()
        user = self.get_user_by_username(username)
        if not user:
            user = self.get_user_by_email(username.lower())
        if not user:
            return False
        if not self.verify_password(password, user['password_hash']):
            return False
        return dict(user)

    def update_user(self, current_username: str, new_username: str = None, new_avatar_url: str = None):
        current_username = current_username.strip()
        user = self.get_user_by_username(current_username)
        if not user:
            raise ValueError("User not found")
        
        target_username = current_username
        if new_username:
            new_username = new_username.strip()
            if not new_username:
                raise ValueError("Username cannot be empty")
            if new_username != current_username:
                if self.get_user_by_username(new_username):
                    raise ValueError(f"Username '{new_username}' is already taken")
                target_username = new_username

        target_avatar = user["avatar_url"]
        if new_avatar_url is not None:
            target_avatar = new_avatar_url.strip()

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE users SET username = ?, avatar_url = ? WHERE id = ?",
                (target_username, target_avatar, user["id"])
            )
            conn.commit()

        updated = self.get_user_by_username(target_username)
        return dict(updated)

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
