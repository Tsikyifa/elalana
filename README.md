# Elalana

## Prérequis

- Python 3.11+
- Node.js 18+
- npm
- PostgreSQL (si le projet est configuré pour utiliser une base locale ou distante)

## 1) Lancer le backend Django

```bash
cd TPAPP
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seedaxe
python manage.py import_referentiel
python manage.py runserver 0.0.0.0:8000
```

Le backend sera disponible sur :
- http://localhost:8000

## 2) Lancer le frontend React

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

Le frontend sera disponible sur :
- http://localhost:5173

## 3) Créer un superutilisateur (si nécessaire)

```bash
cd TPAPP
source .venv/bin/activate
python manage.py createsuperuser
```

## 4) Commandes utiles

```bash
cd TPAPP
source .venv/bin/activate
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py seedaxe
python manage.py import_referentiel
```

> Les commandes ci-dessus sont écrites de manière portable et ne dépendent pas d’un chemin absolu local comme /home/... .


