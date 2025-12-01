from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../backend'))

from main import app

# Vercel requires the app to be exposed
# The import above exposes 'app' from backend/main.py
