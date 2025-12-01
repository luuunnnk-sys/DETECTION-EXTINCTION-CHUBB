from pydantic import BaseModel
from typing import Dict
import math

class RoomDimensions(BaseModel):
    length: float
    width: float
    height_fp: float
    height_amb: float
    height_fc: float
    temperature: float = 20.0  # Température par défaut en °C

class GasCalculationResult(BaseModel):
    volume_total: float
    agent_details: Dict[str, Dict[str, float]]
    extinction_system: Dict[str, float] = {}

def calculate_gas_needs(dims: RoomDimensions) -> GasCalculationResult:
    """
    Calcule la quantité de gaz nécessaire selon les normes (ex: ISO 14520 / EN 15004).
    Utilise la formule de base : M = V * (C / (100 - C)) * (1 / S)
    """
    
    # Calcul du volume total (Faux-plancher + Ambiance + Faux-plafond)
    volume = (dims.length * dims.width) * (dims.height_fp + dims.height_amb + dims.height_fc)
    
    # Constantes pour Novec 1230 (FK-5-1-12) et FM-200 (HFC-227ea) à 20°C
    # Ces valeurs sont approximatives pour l'exemple.
    
    # Novec 1230
    conc_novec = 4.5 
    s_novec = 0.0664 + (0.000274 * dims.temperature)
    mass_novec = volume * (conc_novec / (100 - conc_novec)) * (1 / s_novec)
    
    # FM-200
    conc_fm200 = 7.9
    s_fm200 = 0.1269 + (0.000513 * dims.temperature)
    mass_fm200 = volume * (conc_fm200 / (100 - conc_fm200)) * (1 / s_fm200)
    
    # --- Calculs Extinction (IG55 / Hi-Fog) ---
    area = dims.length * dims.width
    
    # User rule for cylinders: 1 cylinder per 30m2
    cylinders_ig55 = math.ceil(area / 30.0)
    
    # User rule for nozzles: 1 nozzle per 30m2
    nozzles_ig55 = math.ceil(area / 30.0)
    
    # Hi-Fog (Water Mist)
    nozzle_count_est_hifog = max(1, area / 16)
    water_volume_liters = nozzle_count_est_hifog * 10 * 30 
    
    return GasCalculationResult(
        volume_total=round(volume, 2),
        agent_details={
            "Novec 1230": {
                "mass_kg": round(mass_novec, 2),
                "concentration_design": conc_novec
            },
            "FM-200": {
                "mass_kg": round(mass_fm200, 2),
                "concentration_design": conc_fm200
            }
        },
        extinction_system={
            "ig55_cylinders": int(cylinders_ig55),
            "ig55_nozzles": int(nozzles_ig55),
            "hifog_tank_liters": int(water_volume_liters)
        }
    )
