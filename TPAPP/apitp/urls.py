# urls.py
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    IntervenantViewSet,
    DoleanceViewSet,
    PromesseViewSet,
    EtapeTraitementViewSet,
    EtapePromesseViewSet,
    LocalisationViewSet,
    AxeViewSet,
    BacViewSet,
    MarcheViewSet,
    AvancementViewSet,
    OSViewSet,
    MessageMarcheViewSet,
    TravauxGlisseViewSet,
    ConventionProgrammeViewSet,
    DashboardStatsView,
    MarcheCartoView,
    CurrentUserView,
    UserManagementView,
)

router = DefaultRouter()
router.register('intervenants', IntervenantViewSet)
router.register('doleances', DoleanceViewSet)
router.register('etapes-traitement', EtapeTraitementViewSet)
router.register('promesses', PromesseViewSet)
router.register('etapes-promesse', EtapePromesseViewSet)
router.register('localisations', LocalisationViewSet)

# Travaux Publics REST endpoints
router.register('travaux/axes', AxeViewSet, basename='axe')
router.register('travaux/bacs', BacViewSet, basename='bac')
router.register('travaux/marches', MarcheViewSet, basename='marche')
router.register('travaux/avancements', AvancementViewSet, basename='avancement')
router.register('travaux/messages', MessageMarcheViewSet, basename='message-marche')
router.register('travaux/os', OSViewSet, basename='os')
router.register('travaux/glissements', TravauxGlisseViewSet, basename='glissement')
router.register('travaux/conventions', ConventionProgrammeViewSet, basename='convention')

urlpatterns = [
    path('auth/me/', CurrentUserView.as_view(), name='api_current_user'),
    path('users/', UserManagementView.as_view(), name='api_user_management'),
    path('users/<int:user_id>/', UserManagementView.as_view(), name='api_user_management_detail'),
    path('apitp/dashboard/stats/', DashboardStatsView.as_view(), name='api_apitp_dashboard_stats'),
    path('travaux/stats/dashboard/', DashboardStatsView.as_view(), name='api_dashboard_stats'),
    path('carto/marche/<uuid:marche_id>/', MarcheCartoView.as_view(), name='api_marche_carto'),
] + router.urls

