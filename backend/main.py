from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# Add current directory to path to import calculations
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from calculations import calculate_gas_needs, RoomDimensions, GasCalculationResult

app = FastAPI(title="Architecture & Sécurité 3D - Pro Backend")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/calculate-gas", response_model=GasCalculationResult)
async def get_gas_calculation(dims: RoomDimensions):
    return calculate_gas_needs(dims)

# Serve Frontend
# We assume the frontend is in the parent directory under 'frontend'
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
else:
    print(f"Warning: Frontend directory not found at {frontend_path}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
