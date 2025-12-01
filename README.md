# Architecture & Sécurité 3D - Pro

Ce projet a été restructuré pour séparer le Frontend (Interface) du Backend (Logique Python).

## Structure
- `backend/`: Contient le code Python (FastAPI) et les calculs de gaz (Normes).
- `frontend/`: Contient l'interface HTML/JS/CSS.

## Installation

1. Assurez-vous d'avoir Python installé.
2. Installez les dépendances :
   ```bash
   pip install -r backend/requirements.txt
   ```

## Lancement

1. Lancez le serveur Python :
   ```bash
   python backend/main.py
   ```
2. Ouvrez votre navigateur à l'adresse : http://localhost:8000

## Fonctionnalités
- **Visualisation 3D** : Three.js (inchangé, juste réorganisé).
- **Calculs Backend** : Les dimensions sont envoyées au serveur Python qui retourne la quantité de gaz (Novec 1230 / FM-200) selon les normes.
