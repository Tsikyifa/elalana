from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Prefetch

# Create your views here.
# views.py

from .models import (
    Intervenant,
    Doleance,
    EtapePromesse,
    EtapeTraitement
)
from .serializers import *
from travaux.models import (
    Localisation, Axe, Bac, Marche, PKMarche, Avancement, MediaAvancement, OS,
    TravauxGlisse, ConventionProgramme, MessageMarche
)
from django.db.models import Sum, Count, Q, Avg
from django.http import JsonResponse

from rest_framework.views import APIView
from rest_framework import viewsets, parsers, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed, NotFound, PermissionDenied
from shapely.geometry import mapping

from .geo_utils import (
    designation_to_geojson_path,
    designation_to_ref,
    extract_segment_between_pk,
    load_route_pieces,
    reproject_to_wgs84,
)
from travaux.mixins import (
    ROLE_ALIASES,
    filter_queryset_for_user,
    user_can_access_marche,
    is_admin_like_user,
    is_project_manager_user,
    is_visitor_user,
)

ACTIVE_ROLES = ['admin', 'chef_de_projet', 'drtp', 'visiteur']


def _get_dashboard_period(request):
    return (request.query_params.get('periode') or 'annee').strip().lower()


def _matches_dashboard_period(date_value, periode: str):
    if periode == 'tout' or date_value is None:
        return True

    today = timezone.now().date()

    if periode == 'mois':
        return date_value.year == today.year and date_value.month == today.month

    if periode == 'trimestre':
        current_quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        return (
            date_value.year == today.year and
            current_quarter_start_month <= date_value.month <= today.month
        )

    if periode == 'annee':
        return date_value.year == today.year

    return True


def _get_dashboard_reference_date(marche):
    reference = getattr(marche, 'date_demarrage_effective', None) or getattr(marche, 'os_com', None) or getattr(marche, 'date_fin_actualisee', None)
    if reference is None:
        return None
    if isinstance(reference, str):
        try:
            from datetime import datetime
            return datetime.fromisoformat(reference).date()
        except ValueError:
            return None
    return reference


def canonicalize_role_name(role_name):
    if role_name is None:
        return None

    normalized = str(role_name).strip().lower().replace(' ', '_')
    for canonical_name, aliases in ROLE_ALIASES.items():
        if normalized == canonical_name or normalized in aliases:
            return canonical_name
    return normalized if normalized in ACTIVE_ROLES else None


def get_auth_cookie_config(host: str, is_production: bool | None = None):
    host = (host or '').lower()
    production = is_production if is_production is not None else ('elalana.mg' in host or host.endswith('.mg'))

    if production and (host.endswith('.elalana.mg') or host in {'elalana.mg', 'www.elalana.mg', 'back.elalana.mg', 'dev.elalana.mg'}):
        return {
            'domain': '.elalana.mg',
            'secure': True,
            'samesite': 'None',
        }

    return {
        'domain': None,
        'secure': False,
        'samesite': 'Lax',
    }


@method_decorator(csrf_exempt, name='dispatch')
class CustomAuthToken(ObtainAuthToken):
    # Désactiver l'authentification préalable : un utilisateur qui tente de se
    # connecter ne doit pas être rejeté avec 401 si un ancien cookie token périmé subsiste.
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # � Autoriser tout utilisateur actif valide : chef de projet, chef d'axe,
        # gestionnaire, etc. L'accès aux données reste contrôlé par les permissions
        # métier et les filtres d’assignation par axe/marché.
        if not getattr(user, 'is_active', False):
            raise AuthenticationFailed("Accès refusé : compte inactif")

        token, _ = Token.objects.get_or_create(user=user)

        response = JsonResponse({
            "message": "Login réussi",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })

        cookie_config = get_auth_cookie_config(request.get_host(), is_production=not settings.DEBUG)

        response.set_cookie(
            key="access",
            value=token.key,
            httponly=True,
            secure=cookie_config['secure'],
            samesite=cookie_config['samesite'],
            domain=cookie_config['domain'],
            path="/",
            max_age=60 * 60 * 24 * 7,
        )

        return response


@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    # La déconnexion doit aboutir même avec un cookie périmé : sinon le navigateur
    # garde un cookie invalide et la session ne se referme jamais proprement.
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # On supprime le jeton : un cookie rejoué ne vaut plus rien.
        token = request.COOKIES.get("access")
        if token:
            Token.objects.filter(key=token).delete()

        cookie_config = get_auth_cookie_config(request.get_host(), is_production=not settings.DEBUG)
        response = Response({"message": "logout"})

        delete_kwargs = {
            'path': '/',
            'samesite': cookie_config['samesite'],
        }
        if cookie_config['domain'] is not None:
            delete_kwargs['domain'] = cookie_config['domain']

        # HttpResponseBase.delete_cookie() does not accept 'secure' or
        # 'httponly' keyword arguments; pass only supported ones.
        response.delete_cookie("access", **delete_kwargs)
        response.delete_cookie("sessionid", **delete_kwargs)
        if cookie_config['domain'] is not None:
            # Sécurité supplémentaire : purger aussi sans domain explicite
            response.delete_cookie("access", path='/')
            response.delete_cookie("sessionid", path='/')
        return response


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        roles = []
        for role_name in user.groups.values_list('name', flat=True).order_by('name'):
            canonical = canonicalize_role_name(role_name)
            if canonical is not None and canonical not in roles:
                roles.append(canonical)

        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'is_project_manager': is_project_manager_user(user),
                'is_active': user.is_active,
                'roles': roles,
            },
            'can_manage_users': user.is_superuser or is_admin_like_user(user),
        })


class UserManagementView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not (request.user.is_superuser or is_admin_like_user(request.user)):
            raise PermissionDenied('Accès réservé au superutilisateur ou à l’admin.')

        users = get_user_model().objects.prefetch_related('groups').order_by('username')
        roles = [
            {'id': index, 'name': role_name}
            for index, role_name in enumerate(ACTIVE_ROLES)
        ]

        serialized_users = []
        for user in users:
            user_roles = []
            for role_name in user.groups.values_list('name', flat=True).order_by('name'):
                canonical = canonicalize_role_name(role_name)
                if canonical is not None and canonical not in user_roles:
                    user_roles.append(canonical)

            serialized_users.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'roles': user_roles,
            })

        return Response({
            'users': serialized_users,
            'roles': roles,
        })

    def post(self, request):
        if not request.user.is_superuser:
            raise PermissionDenied('Accès réservé au superutilisateur.')

        username = str(request.data.get('username') or '').strip()
        password = request.data.get('password')
        email = str(request.data.get('email') or '').strip()
        first_name = str(request.data.get('first_name') or '').strip()
        last_name = str(request.data.get('last_name') or '').strip()
        raw_roles = request.data.get('roles') or request.data.get('role') or []

        if not username or not password:
            return Response({'detail': 'Le nom d’utilisateur et le mot de passe sont obligatoires.'}, status=400)

        if get_user_model().objects.filter(username__iexact=username).exists():
            return Response({'detail': 'Ce nom d’utilisateur existe déjà.'}, status=400)

        if isinstance(raw_roles, str):
            raw_roles = [raw_roles]

        user = get_user_model().objects.create_user(
            username=username,
            email=email or '',
            password=str(password),
            first_name=first_name,
            last_name=last_name,
            is_active=True,
        )

        canonical_roles = []
        if raw_roles:
            for role_name in raw_roles:
                if not role_name:
                    continue
                canonical = canonicalize_role_name(role_name)
                if canonical is not None and canonical not in canonical_roles:
                    canonical_roles.append(canonical)

        if canonical_roles:
            for role_name in canonical_roles:
                group, _ = Group.objects.get_or_create(name=role_name)
                user.groups.add(group)

        user_roles = []
        for role_name in user.groups.values_list('name', flat=True).order_by('name'):
            canonical = canonicalize_role_name(role_name)
            if canonical is not None and canonical not in user_roles:
                user_roles.append(canonical)

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'roles': user_roles,
        }, status=201)

    def delete(self, request, user_id=None):
        if not request.user.is_superuser:
            raise PermissionDenied('Accès réservé au superutilisateur.')

        if user_id is None:
            return Response({'detail': 'Identifiant utilisateur requis.'}, status=400)

        user_to_delete = get_user_model().objects.filter(pk=user_id).first()
        if user_to_delete is None:
            return Response({'detail': 'Utilisateur introuvable.'}, status=404)

        if user_to_delete.pk == request.user.pk:
            return Response({'detail': 'Vous ne pouvez pas supprimer votre propre compte.'}, status=400)

        if user_to_delete.is_superuser and get_user_model().objects.filter(is_superuser=True).count() <= 1:
            return Response({'detail': 'Impossible de supprimer le dernier superutilisateur.'}, status=400)

        user_to_delete.delete()
        return Response({'detail': 'Utilisateur supprimé avec succès.'}, status=200)


class IntervenantViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Intervenant.objects.all()
    serializer_class = IntervenantSerializer


class DoleanceViewSet(viewsets.ModelViewSet):

    queryset = Doleance.objects.all().order_by('-created_at')

    serializer_class = DoleanceSerializer
    # Indispensable pour bloquer l'AnonymousUser
    permission_classes = [permissions.IsAuthenticated]

    # ParserClasses pour gérer le FormData (fichiers) envoyé par Next.js
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        # On injecte l'utilisateur ici, c'est la méthode la plus propre en DRF
        serializer.save(responsable_insert=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if user is None or not user.is_authenticated:
            return qs.none()
        if user.is_staff or user.is_superuser:
            return qs
        # Normal users only see their own demandes
        return qs.filter(responsable_insert=user)


class EtapeTraitementViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = EtapeTraitement.objects.all()
    serializer_class = EtapeTraitementSerializer


class PromesseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Promesse.objects.all()
    serializer_class = PromesseSerializer

    def perform_create(self, serializer):
        # On injecte automatiquement l'utilisateur connecté comme responsable
        serializer.save(responsable_insert=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if user is None or not user.is_authenticated:
            return qs.none()
        if user.is_staff or user.is_superuser:
            return qs
        return qs.filter(responsable_insert=user)


class EtapePromesseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = EtapePromesse.objects.all()
    serializer_class = EtapePromesseSerializer


class LocalisationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Liste des localisations pour remplir les sélecteurs du frontend.
    """
    queryset = Localisation.objects.all().order_by('province', 'region', 'district')
    serializer_class = LocalisationSerializer
    # Désactive la pagination pour ce ViewSet si vous voulez tous les districts d'un coup
    pagination_class = None


class AxeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Axes routiers, en lecture seule : sert à remplir le sélecteur du formulaire Bac.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AxeSerializer
    pagination_class = None

    def get_queryset(self):
        """Supporte le filtre optionnel `?decoupage=avec|sans`.

        - `avec`  => axes ayant au moins un PKDistrict lié
        - `sans`  => axes sans PKDistrict
        - sinon  => tous les axes
        """
        qs = Axe.objects.all().order_by('designation')
        dec = None
        try:
            dec = self.request.query_params.get('decoupage')
        except Exception:
            dec = None

        if dec == 'avec':
            qs = qs.filter(segments_districts__isnull=False).distinct().order_by('designation')
        elif dec == 'sans':
            qs = qs.filter(segments_districts__isnull=True).order_by('designation')

        return filter_queryset_for_user(self.request.user, qs)


class BacViewSet(viewsets.ModelViewSet):
    """
    CRUD complet des bacs de traversée.
    Alimente la liste du frontend et le formulaire « Nouveau Bac ».
    """
    permission_classes = [permissions.IsAuthenticated]
    queryset = Bac.objects.select_related('axe').order_by('-id')
    serializer_class = BacSerializer
    # Le frontend affiche la liste complète : pas de pagination.
    pagination_class = None


# --- STATISTIQUES DÉCISIONNELLES (DASHBOARD) ---
@method_decorator(never_cache, name='dispatch')
class DashboardStatsView(APIView):
    """
    Fournit l'ensemble des données agrégées pour le tableau de bord décisionnel React :
    - Cartes KPI (Budget engagé, avancement physique moyen, marchés en retard, reliquats glissements)
    - Matrice de financement croisée (par source et état)
    - Statistiques du parc des bacs
    - Suivi des validations AUC
    - Alertes dynamiques
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        is_project_manager_scope = is_project_manager_user(request.user)
        periode = _get_dashboard_period(request)

        # 1. Tous les marchés avec leur dernier avancement
        marches = Marche.objects.select_related('axe').prefetch_related(
            Prefetch(
                'avancements',
                queryset=Avancement.objects.order_by('-date_avancement'),
                to_attr='avancements_list'
            )
        )
        marches = filter_queryset_for_user(request.user, marches)

        if is_project_manager_scope:
            marches = marches.filter(axe__attache_suivi=request.user)
        elif not (request.user.is_superuser or is_admin_like_user(request.user) or is_visitor_user(request.user)):
            marches = marches.filter(axe__attache_suivi=request.user)

        marches = list(marches)
        if periode != 'tout':
            marches = [
                marche for marche in marches
                if _matches_dashboard_period(_get_dashboard_reference_date(marche), periode)
            ]

        total_budget = sum(float(marche.montant or 0) for marche in marches)

        # Liste des derniers avancements (un seul par marché ayant des avancements)
        derniers_avancements = []
        for m in marches:
            if m.avancements_list:
                derniers_avancements.append(m.avancements_list[0])

        derniers_av_physique = [
            float(av.avancement_physique) for av in derniers_avancements
            if av.avancement_physique is not None
        ]
        avg_physique = (sum(derniers_av_physique) / len(derniers_av_physique)) if derniers_av_physique else 0

        marches_en_retard_count = sum(1 for av in derniers_avancements if av.est_en_retard)
        marches_acheves_count = sum(1 for av in derniers_avancements if av.situation_w == 'Acheve')

        glissements_2026 = TravauxGlisse.objects.filter(annee_report=2026)
        if is_project_manager_scope:
            glissements_2026 = glissements_2026.filter(marche__axe__attache_suivi=request.user)
        reliquat_total_2026 = glissements_2026.aggregate(total=Sum('montant_reliquat'))['total'] or 0
        auc_obtenues = glissements_2026.filter(auc='Obtenue').count()
        auc_en_attente = glissements_2026.filter(auc='En attente').count()
        total_auc = auc_obtenues + auc_en_attente
        auc_pct = round((auc_obtenues / total_auc * 100) if total_auc > 0 else 0, 1)

        # 3. Matrice de financement croisée (prend en compte TOUS les marchés créés)
        financements = ['RPI', 'FR', 'FIN_EX', 'Rech_finan', 'AUTRE']
        etats = ['En_ph', 'En_passation', 'En_cours', 'Arrete', 'Acheve']

        lignes_map = {
            fin: {
                'type': fin,
                'details': {etat: 0 for etat in etats},
                'total': 0,
                'retard': 0,
            }
            for fin in financements
        }

        total_global_details = {etat: 0 for etat in etats}
        total_global_marches = 0
        total_global_retard = 0

        for m in marches:
            fin = m.financement if m.financement in lignes_map else 'AUTRE'
            dernier_av = m.avancements_list[0] if m.avancements_list else None

            if dernier_av:
                if dernier_av.situation_w == 'Acheve':
                    etat = 'Acheve'
                elif dernier_av.situation_w == 'Arrete':
                    etat = 'Arrete'
                else:
                    etat = 'En_cours'
                en_retard = bool(dernier_av.est_en_retard)
            else:
                if m.etape_actuelle in ['ETUDE', 'VISE_TECH']:
                    etat = 'En_ph'
                elif m.etape_actuelle == 'EXE':
                    etat = 'En_cours'
                else:
                    etat = 'En_passation'
                en_retard = False

            lignes_map[fin]['details'][etat] += 1
            lignes_map[fin]['total'] += 1
            total_global_details[etat] += 1
            total_global_marches += 1

            if en_retard:
                lignes_map[fin]['retard'] += 1
                total_global_retard += 1

        recap_financement = list(lignes_map.values())
        recap_financement.append({
            'type': 'TOTAL GLOBAL',
            'details': total_global_details,
            'total': total_global_marches,
            'retard': total_global_retard
        })

        # 4. Statistiques des Bacs de traversée
        bacs = Bac.objects.all()
        if is_project_manager_scope:
            bacs = bacs.filter(axe__attache_suivi=request.user)
        total_bacs = bacs.count()
        bacs_operationnels = bacs.filter(etat_bac='Operationel').count()
        bacs_hors_usage = bacs.filter(etat_bac='Hors_usage').count()
        besoin_entretien_bac = bacs.aggregate(total=Sum('besoin_entretien_bac'))['total'] or 0

        propulsion_counts = {
            'Moteur': bacs.filter(propulsion='Moteur').count(),
            'Perche': bacs.filter(propulsion='Perche').count(),
            'Treuil': bacs.filter(propulsion='Treuil').count(),
            'Treuil_a_moteur': bacs.filter(propulsion='Treuil_a_moteur').count(),
        }

        # 5. Alertes dynamiques
        alerts = []
        if marches_en_retard_count > 0:
            alerts.append(f"{marches_en_retard_count} marché(s) dépassent le seuil de délai planifié.")
        if auc_en_attente > 0:
            alerts.append(f"{auc_en_attente} dossier(s) d'Autorisation Unique de Crédit (AUC) à relancer.")
        if bacs_hors_usage > 0:
            alerts.append(f"{bacs_hors_usage} bac(s) fluvial(aux) actuellement hors d'usage.")
        if not alerts:
            alerts.append("Tous les chantiers et programmes suivent le calendrier prévisionnel.")

        response_data = {
            'scope': 'project_manager' if is_project_manager_scope else 'global',
            'summary_cards': {
                'budget_engage': float(total_budget),
                'avancement_physique': round(float(avg_physique), 1),
                'marches_en_retard': marches_en_retard_count,
                'marches_acheves': marches_acheves_count,
                'reliquats_glissements': float(reliquat_total_2026),
            },
            'recap_financement': recap_financement,
            'bac_stats': {
                'total': total_bacs,
                'operationnels': bacs_operationnels,
                'hors_usage': bacs_hors_usage,
                'besoin_entretien': float(besoin_entretien_bac),
                'propulsion': propulsion_counts,
            },
            'auc_stats': {
                'obtenues': auc_obtenues,
                'en_attente': auc_en_attente,
                'progression_pct': auc_pct,
            },
            'alerts': alerts,
        }

        response = Response(response_data)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response


# --- GESTION DES MARCHÉS (PPM) ---
class MarcheViewSet(viewsets.ModelViewSet):
    """
    CRUD complet des marchés publics de travaux.
    Supporte la recherche par texte (numéro, description, entreprise, axe)
    et les filtres par axe, financement et étape.
    """
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        queryset = Marche.objects.select_related('axe').prefetch_related(
            'segments_pk', 'ordres_service', 'avancements__medias'
        ).order_by('axe__designation', 'resume')

        q = self.request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(description__icontains=q) |
                Q(resume__icontains=q) |
                Q(titulaire__icontains=q) |
                Q(num_marche__icontains=q) |
                Q(axe__designation__icontains=q)
            )

        axe = self.request.query_params.get('axe', '').strip()
        if axe:
            queryset = queryset.filter(axe__designation=axe)

        financement = self.request.query_params.get('financement', '').strip()
        if financement:
            queryset = queryset.filter(financement=financement)

        etape = self.request.query_params.get('etape', '').strip()
        if etape:
            queryset = queryset.filter(etape_actuelle=etape)

        status_scope = self.request.query_params.get('status_scope', '').strip()
        if status_scope == 'active':
            queryset = queryset.filter(Q(est_anticipe=True) | Q(etape_actuelle='EXE'))
        elif status_scope == 'anticipe':
            queryset = queryset.filter(est_anticipe=True)
        elif status_scope == 'inactive':
            queryset = queryset.exclude(Q(est_anticipe=True) | Q(etape_actuelle='EXE'))

        # Authorization: restrict non-staff users to marches attached to their axe
        user = getattr(self.request, 'user', None)
        return filter_queryset_for_user(user, queryset)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MarcheWriteSerializer
        if self.action == 'retrieve':
            return MarcheDetailSerializer
        return MarcheListSerializer


def _user_can_access_marche(user, marche: Marche) -> bool:
    return user_can_access_marche(user, marche)


def get_marche_carto_color(marche: Marche) -> str:
    """Couleur du tracé selon l'étape / le retard (aligné sur la spec cartographie)."""
    if marche.etape_actuelle == 'EXE':
        dernier_av = marche.avancements.first()
        if dernier_av and dernier_av.est_en_retard:
            return '#ef4444'
        return '#10b981'
    if marche.etape_actuelle in ('ATTRIBUE', 'SIGNATURE', 'EVALUATION', 'AO_LANCE'):
        return '#f59e0b'
    return '#3b82f6'


class MarcheCartoView(APIView):
    """
    GeoJSON FeatureCollection des tronçons PK d'un marché (calcul EPSG:29701 côté serveur).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, marche_id):
        marche = get_object_or_404(
            Marche.objects.select_related('axe').prefetch_related('segments_pk', 'avancements'),
            pk=marche_id,
        )

        if not _user_can_access_marche(request.user, marche):
            raise PermissionDenied('Accès refusé à ce marché.')

        designation = (marche.axe.designation or '').strip()
        if not designation:
            return Response({'detail': "L'axe du marché n'a pas de désignation."}, status=400)

        try:
            geojson_path = designation_to_geojson_path(designation)
            ref = designation_to_ref(designation)
            route_pieces = load_route_pieces(geojson_path, ref)
        except FileNotFoundError as exc:
            raise NotFound(str(exc)) from exc
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)

        segments = list(marche.segments_pk.all())

        color = get_marche_carto_color(marche)
        features = []

        for seg in segments:
            line = extract_segment_between_pk(None, seg.pk_debut, seg.pk_fin, pieces=route_pieces)
            if line.is_empty:
                continue
            line_wgs84 = reproject_to_wgs84(line)
            features.append({
                'type': 'Feature',
                'geometry': mapping(line_wgs84),
                'properties': {
                    'marche_id': str(marche.id),
                    'resume': marche.resume,
                    'description': getattr(seg, 'description', None) or '',
                    'pk_debut': float(seg.pk_debut),
                    'pk_fin': float(seg.pk_fin),
                    'etape_actuelle': marche.etape_actuelle,
                    'color': color,
                    'axe_designation': designation,
                },
            })

        return JsonResponse({'type': 'FeatureCollection', 'features': features})


# --- SUIVI DES AVANCEMENTS ---
class AvancementViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    # Le relevé est envoyé en multipart dès qu'une pièce jointe l'accompagne.
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    queryset = (
        Avancement.objects.select_related('marche')
        .prefetch_related('medias')
        .order_by('-date_avancement')
    )
    serializer_class = AvancementDetailSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        marche_id = self.request.query_params.get('marche')
        if marche_id:
            queryset = queryset.filter(marche_id=marche_id)
        return queryset

    def perform_create(self, serializer):
        """
        `file` et `legend` accompagnent le relevé sans être des champs du modèle :
        on crée la pièce jointe ici, une fois le relevé enregistré.
        """
        avancement = serializer.save()
        fichier = self.request.FILES.get('file')
        if fichier:
            MediaAvancement.objects.create(
                avancement=avancement,
                fichier=fichier,
                legende=(self.request.data.get('legend') or '').strip(),
            )


# --- DISCUSSION D'UN MARCHÉ ---
class MessageMarcheViewSet(viewsets.ModelViewSet):
    """
    Fil de discussion d'un marché, alimenté par l'onglet « Discussion ».

    Les messages d'un marché sont récupérés via `?marche=<id>` ; l'auteur est
    toujours l'utilisateur connecté et chacun ne peut supprimer que les siens.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageMarcheSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    pagination_class = None

    def get_queryset(self):
        queryset = MessageMarche.objects.select_related('marche', 'auteur').order_by('created_at')
        marche_id = self.request.query_params.get('marche')
        if marche_id:
            queryset = queryset.filter(marche_id=marche_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(auteur=self.request.user)

    def perform_destroy(self, instance):
        # Le fil est commun : on ne retire que ses propres messages.
        if instance.auteur_id != self.request.user.id:
            raise PermissionDenied("Vous ne pouvez supprimer que vos propres messages.")
        instance.delete()


# --- ORDRES DE SERVICE (OS) ---
class OSViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = OS.objects.select_related('marche', 'os_arret_concerne').order_by('date_os')
    serializer_class = OSSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        marche_id = self.request.query_params.get('marche')
        if marche_id:
            queryset = queryset.filter(marche_id=marche_id)
        return queryset


# --- TRAVAUX GLISSÉS ---
class TravauxGlisseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = TravauxGlisse.objects.select_related('axe', 'marche').order_by('-annee_report')
    serializer_class = TravauxGlisseSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        annee = self.request.query_params.get('annee')
        if annee:
            queryset = queryset.filter(annee_report=annee)
        return queryset


# --- CONVENTIONS PROGRAMMES ---
class ConventionProgrammeViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = ConventionProgramme.objects.select_related('axe').order_by('-annee', 'axe__designation', 'pk_debut')
    serializer_class = ConventionProgrammeSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.query_params.get('q', '').strip()
        if q:
            queryset = queryset.filter(
                Q(section__icontains=q) |
                Q(axe__designation__icontains=q) |
                Q(region__icontains=q)
            )
        region = self.request.query_params.get('region', '').strip()
        if region:
            queryset = queryset.filter(region=region)
        surface = self.request.query_params.get('surface', '').strip()
        if surface:
            queryset = queryset.filter(nature_surface=surface)
        annee = self.request.query_params.get('annee', '').strip()
        if annee:
            queryset = queryset.filter(annee=annee)
        return queryset