# urls.py
from rest_framework.routers import DefaultRouter
from .views import (
    IntervenantViewSet,
    DoleanceViewSet,
    PromesseViewSet,
    EtapeTraitementViewSet,
    EtapePromesseViewSet,
    LocalisationViewSet,
)



router = DefaultRouter()
router.register('intervenants', IntervenantViewSet)
router.register('doleances', DoleanceViewSet)
router.register('etapes-traitement', EtapeTraitementViewSet)
router.register('promesses', PromesseViewSet)
router.register('etapes-promesse', EtapePromesseViewSet)
router.register('localisations', LocalisationViewSet)

urlpatterns = router.urls