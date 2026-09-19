from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from app.api.routes import router

app = FastAPI(title="Quant Platform API", version="1.0.1")

# Setup CORS for the frontend (allows local dev and deployed frontend such as Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?:\/\/.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
app.include_router(router) # Fallback without prefix to prevent 404 if /api is omitted

@app.get("/")
def root():
    return {"status": "ok", "message": "Quant Platform API is online", "docs": "/docs"}

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Quant Platform API is running"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
