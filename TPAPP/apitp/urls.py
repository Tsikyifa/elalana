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
    path('travaux/stats/dashboard/', DashboardStatsView.as_view(), name='api_dashboard_stats'),
] + router.urls

