from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.core.exceptions import PermissionDenied
from .models import Marche, Avancement, OS


ROLE_ALIASES = {
    'admin': {'admin', 'superadmin', 'administrateur', 'administrateur_systeme'},
    'chef_de_projet': {'chef_de_projet', 'chef_projet', 'project_manager'},
    'drtp': {'drtp', 'gestionnaire_de_reference', 'gestionnaire_reference'},
    'visiteur': {'visiteur', 'ministre', 'viewer', 'visiteur_ministre', 'visiteur_sg', 'visiteur_dgtp', 'audience_ministre', 'audience_op'},
}


def get_user_group_names(user):
    if user is None or not getattr(user, 'is_authenticated', False):
        return set()

    raw_names = {
        str(name).strip().lower().replace(' ', '_')
        for name in user.groups.values_list('name', flat=True)
    }

    canonical_names = set()
    for canonical_name, aliases in ROLE_ALIASES.items():
        if raw_names & aliases:
            canonical_names.add(canonical_name)

    canonical_names.update(raw_names)
    return canonical_names


def is_admin_like_user(user):
    if user is None or not getattr(user, 'is_authenticated', False):
        return False

    group_names = get_user_group_names(user)
    if getattr(user, 'is_superuser', False) or getattr(user, 'is_staff', False):
        return True

    return 'admin' in group_names


def is_project_manager_user(user):
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if is_admin_like_user(user):
        return False

    return 'chef_de_projet' in get_user_group_names(user)


def is_drtp_user(user):
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if is_admin_like_user(user):
        return True
    return 'drtp' in get_user_group_names(user)


def is_visitor_user(user):
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if is_admin_like_user(user):
        return True
    return 'visiteur' in get_user_group_names(user)


def user_can_access_axe(user, axe):
    if is_admin_like_user(user) or is_visitor_user(user):
        return True
    if axe is None:
        return False
    return getattr(axe, 'attache_suivi_id', None) == getattr(user, 'pk', None)


def filter_queryset_for_user(user, queryset):
    if queryset is None:
        return queryset
    if user is None or not getattr(user, 'is_authenticated', False):
        return queryset.none()
    if is_admin_like_user(user) or is_visitor_user(user):
        return queryset

    model_name = queryset.model.__name__

    if is_project_manager_user(user):
        if model_name == 'Axe':
            return queryset.filter(attache_suivi=user)
        if model_name == 'Marche':
            return queryset.filter(axe__attache_suivi=user)
        if model_name == 'PKMarche':
            return queryset.filter(marche__axe__attache_suivi=user)
        if model_name == 'Avancement':
            return queryset.filter(marche__axe__attache_suivi=user)
        if model_name == 'OS':
            return queryset.filter(marche__axe__attache_suivi=user)

    if model_name == 'Axe':
        return queryset.filter(attache_suivi=user)
    if model_name == 'Marche':
        return queryset.filter(axe__attache_suivi=user)
    if model_name == 'PKMarche':
        return queryset.filter(marche__axe__attache_suivi=user)
    if model_name == 'Avancement':
        return queryset.filter(marche__axe__attache_suivi=user)
    if model_name == 'OS':
        return queryset.filter(marche__axe__attache_suivi=user)
    return queryset


def user_can_access_marche(user, marche):
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    if marche is None:
        return False
    return user_can_access_axe(user, getattr(marche, 'axe', None))


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
        return filter_queryset_for_user(user, qs)

    def dispatch(self, request, *args, **kwargs):
        if is_admin_like_user(request.user):
            return super().dispatch(request, *args, **kwargs)

        obj = self.get_object()

        if hasattr(obj, "axe"):
            if not user_can_access_axe(request.user, obj.axe):
                raise PermissionDenied("Accès refusé.")

        if hasattr(obj, "marche"):
            if not user_can_access_marche(request.user, obj.marche):
                raise PermissionDenied("Accès refusé.")

        if hasattr(obj, "attache_suivi"):
            if not user_can_access_axe(request.user, obj):
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