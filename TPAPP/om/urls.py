# Fichier: om/urls.py (Contenu corrigé)

from django.urls import path, include
# On utilise directement les vues importées de l'application 'om'
from .views import MissionViewSet, VehicleViewSet, PersonneltpViewSet, CheckDisponibiliteAPIView, DirectionViewSet, UserProfileAPIView 
# Vues JWT
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework.routers import DefaultRouter


# --- Routeur pour les ViewSets ---
router = DefaultRouter()
router.register(r'missions', MissionViewSet, basename='missions')
router.register(r"vehicles", VehicleViewSet, basename='vehicles')
router.register(r"personnels", PersonneltpViewSet, basename='personnels')
router.register(r"directions", DirectionViewSet, basename='directions')


urlpatterns = [
    
    # -----------------------------------------------------
    # 1. AUTHENTIFICATION (Standard Simple JWT)
    # -----------------------------------------------------
    # Endpoint de connexion (POST username/password)
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    # Endpoint de rafraîchissement
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    
    # -----------------------------------------------------
    # 2. GESTION DE COMPTE (dj-rest-auth)
    # -----------------------------------------------------
    # Inclut : /logout/, /password/change/, /password/reset/
    path('auth/', include('dj_rest_auth.urls')), 
    
    # Note : Le chemin d'enregistrement est généralement inclus séparément
    # path('auth/registration/', include('dj_rest_auth.registration.urls')),

    # -----------------------------------------------------
    # 3. ENDPOINTS PERSONNALISÉS
    # -----------------------------------------------------
    
    # Profil Utilisateur (Lecture et Mise à jour de l'image)
    # Nous conservons uniquement celui-ci pour la clarté :
    path('profiles/me/', UserProfileAPIView.as_view(), name='user-profile'), 
    
    # Autres APIs simples
    path("check-disponibilite/", CheckDisponibiliteAPIView.as_view(), name="check-disponibilite"),

    # Retiré : path('login/', LoginView.as_view(), name='login'), # <- Redondant avec /token/
    # Retiré : path('me/', UserProfileView.as_view(), name='user_profile'), # <- Redondant avec /profiles/me/
    # Retiré : #path("missions/<uuid:id>/pdf/", generate_pdf, name="generatepdf"), # <- Commenté

]

# 4. Ajout des ViewSets du routeur
urlpatterns += router.urls