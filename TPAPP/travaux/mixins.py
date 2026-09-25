from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.core.exceptions import PermissionDenied
from .models import Marche, Avancement, OS


class ChefMarcheRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        user = self.request.user

        if user.is_superuser:
            return True

        # 🔹 Cas 1 : URL contient marche_id (Create Avancement)
        marche_id = self.kwargs.get("marche_id")
        if marche_id:
            marche = get_object_or_404(Marche, pk=marche_id)
            return marche.axe.attache_suivi == user

        # 🔹 Cas 2 : Update Marche (pk)
        if self.kwargs.get("pk"):
            try:
                obj = self.get_object()
            except:
                return False

            # Si c’est un Marche
            if hasattr(obj, "axe"):
                return obj.axe.attache_suivi == user

            # Si c’est un Avancement
            if hasattr(obj, "marche"):
                return obj.marche.axe.attache_suivi == user

        return False

class ChefAxeRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):

    def test_func(self):
        user = self.request.user

        if user.is_superuser:
            return True

        try:
            axe = self.get_object()
        except:
            return False

        return axe.attache_suivi == user
    
class SuiviPermissionMixin:
    """
    Restreint l'édition aux objets liés à l'utilisateur via axe.attache_suivi.
    Fonctionne pour :
    - Marche
    - Avancement
    - Axe
    """

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if user.is_superuser:
            return qs

        model = qs.model

        # 🔹 Cas 1 : Marche
        if model.__name__ == "Marche":
            return qs.filter(axe__attache_suivi=user)

        # 🔹 Cas 2 : Avancement
        if model.__name__ == "Avancement":
            return qs.filter(marche__axe__attache_suivi=user)

        # 🔹 Cas 3 : Axe
        if model.__name__ == "Axe":
            return qs.filter(attache_suivi=user)

        return qs

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_superuser:
            return super().dispatch(request, *args, **kwargs)

        obj = self.get_object()

        # Marche
        if hasattr(obj, "axe"):
            if obj.axe.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé.")

        # Avancement
        if hasattr(obj, "marche"):
            if obj.marche.axe.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé.")

        # Axe
        if hasattr(obj, "attache_suivi"):
            if obj.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé.")

        return super().dispatch(request, *args, **kwargs)
    

class AdminOrChefAxeMixin(UserPassesTestMixin):
    def test_func(self):
        obj = self.get_object()
        # On remonte jusqu'au marché lié à l'objet (OS ou Avancement)
        marche = None
        if hasattr(obj, 'marche'):
            marche = obj.marche
        elif hasattr(obj, 'axe') and obj.__class__.__name__ == 'Marche':
            marche = obj

        if self.request.user.is_superuser:
            return True

        if marche and hasattr(marche, 'axe') and marche.axe:
            return self.request.user == marche.axe.attache_suivi

        return False