from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
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
    TravauxGlisse, ConventionProgramme, MessageMarche, Notification
)
from django.db.models import Sum, Count, Q, Avg
from django.http import JsonResponse

from rest_framework.views import APIView
from rest_framework import viewsets, parsers, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.decorators import action
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

# --- NOMS DE COOKIES (renommés pour ignorer les fantômes) ---
ACCESS_COOKIE_NAME = 'access_v3'


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


def create_notification_for_user(user, *, notification_type, title, message, related_model=None, related_id=None):
    if user is None or not getattr(user, 'is_authenticated', False):
        return None

    notification = Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        message=message,
        related_model=related_model,
        related_id=str(related_id) if related_id is not None else None,
    )

    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f'user_notifications_{user.id}',
            {
                'type': 'notification.message',
                'payload': NotificationSerializer(notification).data,
            },
        )

    return notification


def get_market_notification_recipients(marche, source_user=None):
    recipients = set()

    pm_user = getattr(getattr(marche, 'axe', None), 'attache_suivi', None) if marche else None
    if pm_user is not None and (source_user is None or pm_user.pk != source_user.pk):
        recipients.add(pm_user)

    for user in get_user_model().objects.filter(is_active=True):
        if source_user is not None and user.pk == source_user.pk:
            continue
        if pm_user is not None and user.pk == pm_user.pk:
            continue
        if is_admin_like_user(user) or is_visitor_user(user):
            recipients.add(user)

    return sorted(recipients, key=lambda user: user.pk)


def get_auth_cookie_config(host: str | None = None, is_production: bool | None = None):
    configured_domain = (
        getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
        or getattr(settings, 'SESSION_COOKIE_DOMAIN', None)
        or getattr(settings, 'CSRF_COOKIE_DOMAIN', None)
    )
    configured_path = (
        getattr(settings, 'AUTH_COOKIE_PATH', None)
        or getattr(settings, 'SESSION_COOKIE_PATH', None)
        or '/'
    )
    configured_secure = (
        getattr(settings, 'AUTH_COOKIE_SECURE', None)
        is not None and getattr(settings, 'AUTH_COOKIE_SECURE')
    ) or getattr(settings, 'SESSION_COOKIE_SECURE', False)
    configured_samesite = (
        getattr(settings, 'AUTH_COOKIE_SAMESITE', None)
        or getattr(settings, 'SESSION_COOKIE_SAMESITE', 'Lax')
    )

    host = (host or '').lower()
    production = is_production if is_production is not None else ('elalana.mg' in host or host.endswith('.mg'))

    if configured_domain:
        return {
            'domain': configured_domain,
            'path': configured_path,
            'secure': configured_secure,
            'samesite': configured_samesite,
        }

    if production and (host.endswith('.elalana.mg') or host in {'elalana.mg', 'www.elalana.mg', 'back.elalana.mg', 'dev.elalana.mg'}):
        return {
            'domain': '.elalana.mg',
            'path': '/',
            'secure': True,
            'samesite': 'None',
        }

    return {
        'domain': None,
        'path': '/',
        'secure': False,
        'samesite': 'Lax',
    }


def _purge_cookies_via_set_cookie(response, cookie_config):
    """Expire chaque cookie UNE fois, avec les mêmes attributs que lors de la pose."""
    cookie_names = (
        ACCESS_COOKIE_NAME,
        settings.SESSION_COOKIE_NAME,
        'csrftoken',
        'access',
        'access_v2',
        'sessionid',
    )
    seen = set()
    for cookie_name in cookie_names:
        if cookie_name in seen:
            continue
        seen.add(cookie_name)
        response.set_cookie(
            key=cookie_name,
            value='',
            max_age=0,
            expires='Thu, 01 Jan 1970 00:00:00 GMT',
            path=cookie_config.get('path', '/'),
            domain=cookie_config.get('domain'),
            secure=cookie_config.get('secure', False),
            httponly=True,
            samesite=cookie_config.get('samesite', 'Lax'),
        )


@method_decorator(csrf_exempt, name='dispatch')
class CustomAuthToken(ObtainAuthToken):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        if not getattr(user, 'is_active', False):
            raise AuthenticationFailed("Accès refusé : compte inactif")

        # Nettoyage de la session précédente
        try:
            request.session.flush()
        except Exception:
            pass

        Token.objects.filter(user=user).delete()
        token = Token.objects.create(user=user)

        cookie_config = get_auth_cookie_config(
            request.get_host(),
            is_production=not settings.DEBUG,
        )

        login(request, user)
        request.session.cycle_key()

        response = JsonResponse({
            "message": "Login réussi",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            },
        })

        # Purge des anciens cookies (sauf ceux qu'on repose juste après)
        _purge_cookies_via_set_cookie(response, cookie_config)

        # Le cookie de session est posé par SessionMiddleware (settings.SESSION_COOKIE_NAME)
        response.set_cookie(
            key=ACCESS_COOKIE_NAME,
            value=token.key,
            httponly=True,
            secure=cookie_config['secure'],
            samesite=cookie_config['samesite'],
            domain=cookie_config['domain'],
            path=cookie_config['path'],
            max_age=60 * 60 * 24 * 7,
        )
        return response

@method_decorator(csrf_exempt, name='dispatch')
class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.sessions.models import Session
        from django.utils import timezone as dj_timezone
        from django.contrib.auth import get_user_model as get_user_model_fn

        user_to_logout = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            user_to_logout = request.user
        elif request.session.get('_auth_user_id'):
            try:
                user_to_logout = get_user_model_fn().objects.get(
                    pk=request.session.get('_auth_user_id')
                )
            except get_user_model_fn().DoesNotExist:
                pass

        if user_to_logout is None:
            for cookie_name in (ACCESS_COOKIE_NAME, 'access_v2', 'access'):
                tok = request.COOKIES.get(cookie_name)
                if tok:
                    try:
                        t = Token.objects.get(key=tok)
                        user_to_logout = t.user
                        break
                    except Token.DoesNotExist:
                        pass

        if user_to_logout is not None:
            now = dj_timezone.now()
            for session in Session.objects.filter(expire_date__gte=now):
                try:
                    data = session.get_decoded()
                    if str(data.get('_auth_user_id')) == str(user_to_logout.pk):
                        session.delete()
                except Exception:
                    pass
            Token.objects.filter(user=user_to_logout).delete()

        for cookie_name in (ACCESS_COOKIE_NAME, 'access_v2', 'access'):
            tok = request.COOKIES.get(cookie_name)
            if tok:
                try:
                    t = Token.objects.get(key=tok)
                    Token.objects.filter(user=t.user).delete()
                except Token.DoesNotExist:
                    pass

        try:
            request.session.flush()
        except Exception:
            pass
        try:
            logout(request)
        except Exception:
            pass

        cookie_config = get_auth_cookie_config(
            request.get_host(),
            is_production=not settings.DEBUG,
        )
        response = Response({"message": "logout"})

        # Expire authoritative cookies using cookie_config
        try:
            response.set_cookie(
                key=settings.SESSION_COOKIE_NAME,
                value='',
                max_age=0,
                expires='Thu, 01 Jan 1970 00:00:00 GMT',
                path=cookie_config.get('path', '/'),
                domain=cookie_config.get('domain', None),
                secure=cookie_config.get('secure', False),
                httponly=True,
                samesite=cookie_config.get('samesite', 'Lax'),
            )
        except Exception:
            pass

        _purge_cookies_via_set_cookie(response, cookie_config)

        return response


@method_decorator(never_cache, name='dispatch')
class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # ============ DEBUG 3 ============
        print("=" * 60)
        print("=== /auth/me/ CALLED ===")
        print("COOKIES REÇUS:", dict(request.COOKIES))
        print("request.user:", request.user.username if request.user.is_authenticated else "anon", "| ID:", getattr(request.user, 'id', None))
        print("=" * 60)
        # ============ FIN DEBUG 3 ============

        # HTTP cache control to avoid stale responses being reused
        response = Response()
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        response['Vary'] = 'Cookie'

        # Diagnostic logging (temporary) to help debug cookie/session clashes
        response['X-Debug-Cookies-Header'] = request.META.get('HTTP_COOKIE', '')
        # The successful authenticator (if any) is set by DRF on the request
        success_auth = getattr(request, 'successful_authenticator', None)
        response['X-Debug-Authenticator'] = getattr(success_auth, '__class__', type(success_auth)).__name__ if success_auth is not None else 'None'

        user = request.user
        roles = []
        for role_name in user.groups.values_list('name', flat=True).order_by('name'):
            canonical = canonicalize_role_name(role_name)
            if canonical is not None and canonical not in roles:
                roles.append(canonical)

        response.data = {
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
        }

        return response


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = None

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'count': count})

    @action(detail=False, methods=['post'], url_path='mark-read')
    def mark_read(self, request):
        notifications = self.get_queryset().filter(is_read=False)
        count = notifications.count()
        notifications.update(is_read=True, read_at=timezone.now())
        return Response({'success': True, 'count': count})


@method_decorator(never_cache, name='dispatch')
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

        response = Response({
            'users': serialized_users,
            'roles': roles,
        })
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

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

        response = Response({
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
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response

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
        response = Response({'detail': 'Utilisateur supprimé avec succès.'}, status=200)
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response


class IntervenantViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Intervenant.objects.all()
    serializer_class = IntervenantSerializer


class DoleanceViewSet(viewsets.ModelViewSet):

    queryset = Doleance.objects.all().order_by('-created_at')

    serializer_class = DoleanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        serializer.save(responsable_insert=self.request.user)

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, 'user', None)
        if user is None or not user.is_authenticated:
            return qs.none()
        if user.is_staff or user.is_superuser:
            return qs
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
    queryset = Localisation.objects.all().order_by('province', 'region', 'district')
    serializer_class = LocalisationSerializer
    pagination_class = None


class AxeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AxeSerializer
    pagination_class = None

    def get_queryset(self):
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
    permission_classes = [permissions.IsAuthenticated]
    queryset = Bac.objects.select_related('axe').order_by('-id')
    serializer_class = BacSerializer
    pagination_class = None


# --- STATISTIQUES DÉCISIONNELLES (DASHBOARD) ---
@method_decorator(never_cache, name='dispatch')
class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        is_project_manager_scope = is_project_manager_user(request.user)
        periode = _get_dashboard_period(request)

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

        bacs = Bac.objects.all()
        if is_project_manager_scope:
            bacs = bacs.filter(axe__attache_suivi=request.user)
        elif not (request.user.is_superuser or is_admin_like_user(request.user) or is_visitor_user(request.user)):
            bacs = bacs.filter(axe__attache_suivi=request.user)
        total_bacs = bacs.count()
        bacs_operationnels = bacs.filter(etat_bac='Operationel').count()
        bacs_hors_usage = bacs.filter(etat_bac='Hors_usage').count()
        besoin_entretien_bac = bacs.aggregate(total=Sum('besoin_entretien_bac'))['total'] or 0

        conventions = ConventionProgramme.objects.select_related('axe').all()
        if is_project_manager_scope:
            conventions = conventions.filter(axe__attache_suivi=request.user)
        elif not (request.user.is_superuser or is_admin_like_user(request.user) or is_visitor_user(request.user)):
            conventions = conventions.filter(axe__attache_suivi=request.user)
        convention_budget = conventions.filter(annee=timezone.now().year).aggregate(total=Sum('montant_souhaite'))['total'] or 0

        propulsion_counts = {
            'Moteur': bacs.filter(propulsion='Moteur').count(),
            'Perche': bacs.filter(propulsion='Perche').count(),
            'Treuil': bacs.filter(propulsion='Treuil').count(),
            'Treuil_a_moteur': bacs.filter(propulsion='Treuil_a_moteur').count(),
        }

        alerts = []
        if marches_en_retard_count > 0:
            alerts.append(f"{marches_en_retard_count} marché(s) dépassent le seuil de délai planifié.")
        if auc_en_attente > 0:
            alerts.append(f"{auc_en_attente} dossier(s) d'Autorisation Unique de Crédit (AUC) à relancer.")
        if bacs_hors_usage > 0:
            alerts.append(f"{bacs_hors_usage} bac(s) fluvial(aux) actuellement hors d'usage.")
        if not alerts:
            alerts.append("Tous les chantiers et programmes suivent le calendrier prévisionnel.")

        if is_project_manager_scope:
            total_budget_engage = float(total_budget)
            budget_breakdown = {
                'travaux': float(total_budget),
            }
        else:
            total_budget_engage = float(total_budget) + float(besoin_entretien_bac) + float(convention_budget)
            budget_breakdown = {
                'travaux': float(total_budget),
                'bac': float(besoin_entretien_bac),
                'convention': float(convention_budget),
            }

        response_data = {
            'scope': 'project_manager' if is_project_manager_scope else 'global',
            'summary_cards': {
                'budget_engage': total_budget_engage,
                'budget_breakdown': budget_breakdown,
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
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # Précharge explicitement le dernier avancement (par date) pour éviter
        # les problèmes d'ordre lors du rendu côté frontend.
        queryset = Marche.objects.select_related('axe').prefetch_related(
            'segments_pk',
            'ordres_service',
            Prefetch(
                'avancements',
                queryset=Avancement.objects.order_by('-date_avancement').prefetch_related('medias'),
                to_attr='dernier_avancement'
            ),
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
    if marche.etape_actuelle == 'EXE':
        dernier_av = marche.avancements.order_by('-date_avancement').first()
        if dernier_av and dernier_av.est_en_retard:
            return '#ef4444'
        return '#10b981'
    if marche.etape_actuelle in ('ATTRIBUE', 'SIGNATURE', 'EVALUATION', 'AO_LANCE'):
        return '#f59e0b'
    return '#3b82f6'


class MarcheCartoView(APIView):
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


class AvancementViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
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
        avancement = serializer.save()
        
        # Récupérer tous les fichiers envoyés (pas juste le premier/dernier)
        fichiers = self.request.FILES.getlist('fichier') or self.request.FILES.getlist('file')
        
        # Créer une pièce jointe pour chaque fichier
        for index, fichier in enumerate(fichiers):
            if fichier:
                # Construire la légende : utiliser celle envoyée ou ajouter un suffixe
                legende = (
                    self.request.data.get('legend')
                    or self.request.data.get('legende')
                    or ''
                ).strip()
                
                # Si plusieurs fichiers, numéroter la légende
                if len(fichiers) > 1:
                    if legende:
                        legende = f"{legende} ({index + 1})"
                    else:
                        legende = f"Pièce jointe {index + 1}"
                
                MediaAvancement.objects.create(
                    avancement=avancement,
                    fichier=fichier,
                    legende=legende,
                )

        marche = avancement.marche
        for recipient in get_market_notification_recipients(marche, source_user=self.request.user):
            create_notification_for_user(
                recipient,
                notification_type='avancement_nouveau',
                title='Nouvel avancement',
                message=f"Un nouvel avancement a été ajouté sur le marché {marche.resume or marche.num_marche or 'non identifié'}.",
                related_model='Marche',
                related_id=str(marche.id),
            )


class MessageMarcheViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageMarcheSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    pagination_class = None

    def _broadcast_message(self, message, event_type):
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        payload = {
            'type': event_type,
            'marche_id': str(message.marche_id),
            'message': MessageMarcheSerializer(message, context={'request': self.request}).data,
        }
        async_to_sync(channel_layer.group_send)(
            f'marche_discussion_{message.marche_id}',
            {'type': 'discussion.message', 'payload': payload},
        )

    def get_queryset(self):
        queryset = MessageMarche.objects.select_related('marche', 'auteur').order_by('created_at')
        marche_id = self.request.query_params.get('marche')
        if marche_id:
            queryset = queryset.filter(marche_id=marche_id)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(auteur=self.request.user)
        self._broadcast_message(instance, 'message.created')

        for recipient in get_market_notification_recipients(instance.marche, source_user=self.request.user):
            if recipient == self.request.user:
                continue
            create_notification_for_user(
                recipient,
                notification_type='message_nouveau',
                title='Nouveau message',
                message=f"Un nouveau message a été publié sur le marché {instance.marche.resume or instance.marche.num_marche or 'non identifié'}.",
                related_model='Marche',
                related_id=str(instance.marche.id),
            )

    def perform_destroy(self, instance):
        if instance.auteur_id != self.request.user.id:
            raise PermissionDenied("Vous ne pouvez supprimer que vos propres messages.")

        marche_id = instance.marche_id
        instance.delete()

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f'marche_discussion_{marche_id}',
                {
                    'type': 'discussion.message',
                    'payload': {
                        'type': 'message.deleted',
                        'marche_id': str(marche_id),
                        'message_id': instance.pk,
                    },
                },
            )


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