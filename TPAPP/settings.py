"""
Django settings for TPAPP project.
...
"""

from pathlib import Path
import os
from datetime import timedelta # <<< 1. AJOUT NÉCESSAIRE POUR JWT

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
SECRET_KEY = "django-insecure-6ebon0n1^*)*7*o4zi$vqjqp*lxu*bztjlv)d-(ds@t&j-p&29"
DEBUG = True
ALLOWED_HOSTS = []

# Application definition

INSTALLED_APPS = [
    # Applications Django standard
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    'django.contrib.humanize',
    
    # <<< 3. AJOUT DE django.contrib.sites >>>
    'django.contrib.sites', 
    
    # Applications API
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework.authtoken', 
    
    # Authentification & Comptes
    'dj_rest_auth',
    'dj_rest_auth.registration',
    
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    #
    'django_filters',
    # Utilitaires
    'corsheaders',
    'import_export',
    'om',
    'travaux',
    'apitp',
    'audience',
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    
    # <<< 2. AJOUT DU MIDDLEWARE ALLAUTH (Correction de la dernière erreur) >>>
    "allauth.account.middleware.AccountMiddleware", 
    
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "TPAPP.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / 'templates'],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "TPAPP.wsgi.application"
os.environ["PGCLIENTENCODING"] = "UTF8"

# Database
DATABASES = {
    "default": {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'tpdb', #elalanam_tpdb
        'USER': 'tp_admin', # elalanam_tp_admin
        'PASSWORD': 'tp_admin_Yes_2026',
        'HOST': 'localhost',      # Ou l'IP de votre serveur
        'PORT': '5432',           # Port par défaut de Postgres
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# -------------------------------------------------------------------
# <<< CONFIGURATION AUTHENTIFICATION ET API >>>
# -------------------------------------------------------------------

# 4. Configuration des Backends d'Authentification (NÉCESSAIRE POUR ALLAUTH)
AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
    'allauth.account.auth_backends.AuthenticationBackend',
)

# 5. Configuration DRF (inchangé)
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apitp.authentification.CookieTokenAuthentication', # Remplacez par le chemin réel vers votre classe
        'rest_framework.authentication.TokenAuthentication', # On garde l'original en secours
        'rest_framework.authentication.SessionAuthentication',
    )
}

CORS_ALLOW_CREDENTIALS = True
# 6. Configuration CORS (frontend Vite + autres ports locaux)
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

CORS_ALLOW_METHODS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
]

CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "x-csrftoken",
    "x-requested-with",
]

# 7. Configuration django-allauth (SITE_ID OBLIGATOIRE)
SITE_ID = 1
ACCOUNT_EMAIL_VERIFICATION = 'none' # Désactive la vérification par email pour simplifier l'API

# 8. Configuration dj-rest-auth (JWT)
REST_AUTH = {
    'USE_JWT': True, 
    'TOKEN_MODEL': None, 
}

# 9. Configuration Simple JWT (durée de vie des tokens)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY, 
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# -------------------------------------------------------------------

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Config import export

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"

# Dossier où seront stockés les fichiers médias
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# URL publique pour y accéder
MEDIA_URL = '/media/'

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGIN_URL = '/accounts/login/'
LOGIN_REDIRECT_URL = 'marche_reporting'
LOGOUT_REDIRECT_URL = '/accounts/login/'

IMPORT_EXPORT_ENCODING = 'utf-8-sig' # Le '-sig' ajoute le BOM pour Excel
IMPORT_EXPORT_SKIP_ADMIN_LOG = True



