from fastapi import FastAPI
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from modules.identity.auth import limiter
from modules.identity.routes import auth_router, operators_router, audit_router
from modules.fleet.routes import drones_router
from modules.reservations.routes import router as reservations_router

from fastapi.middleware.cors import CORSMiddleware
from modules.telemetry.routes import telemetry_router
from modules.telemetry.websocket import websocket_router
app = FastAPI(
    title="Unmanned Flying Objects Traffic Management System (UTM)",
    description="FastAPI + PostgreSQL backend for drone traffic management, identity, and fleet operations.",
    version="1.0.0",
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach rate limiter to app state and register error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include module routers
app.include_router(auth_router)
app.include_router(operators_router)
app.include_router(drones_router)
app.include_router(audit_router)
app.include_router(reservations_router)
app.include_router(telemetry_router)
app.include_router(websocket_router)
@app.get("/", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "service": "UTM Drone Backend",
        "version": "1.0.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
