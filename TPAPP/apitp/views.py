from django.shortcuts import render

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
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

class CustomAuthToken(ObtainAuthToken):

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # 🔒 Autoriser uniquement admin / staff
        if not (user.is_staff or user.is_superuser):
            raise AuthenticationFailed("Accès refusé : Admin uniquement")

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

        # 🍪 Cookie adapté (secure=True uniquement en HTTPS)
        is_secure = request.is_secure()
        response.set_cookie(
            key="access",
            value=token.key,
            httponly=True,
            secure=is_secure,
            samesite="Lax",
            path="/",
        )

        return response

class LogoutView(APIView):
    # La déconnexion doit aboutir même avec un cookie périmé : sinon le navigateur
    # garde un cookie invalide et la session ne se referme jamais proprement.
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # On supprime le jeton : un cookie rejoué ne vaut plus rien.
        token = request.COOKIES.get("access")
        if token:
            Token.objects.filter(key=token).delete()

        response = Response({"message": "logout"})
        response.delete_cookie("access", path="/", samesite="Lax")
        return response

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
    queryset = Axe.objects.all().order_by('designation')
    serializer_class = AxeSerializer
    pagination_class = None


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
        # 1. Derniers avancements de chaque marché
        derniers_av_ids = (
            Avancement.objects.order_by('marche', '-date_avancement')
            .distinct('marche')
            .values_list('id', flat=True)
        )
        derniers_avancements = Avancement.objects.filter(id__in=derniers_av_ids).select_related('marche')

        # 2. Cartes de synthèse (KPIs)
        total_budget = Marche.objects.aggregate(total=Sum('montant'))['total'] or 0
        avg_physique = Avancement.objects.aggregate(avg=Avg('avancement_physique'))['avg'] or 0

        marches_en_retard_count = sum(1 for av in derniers_avancements if av.est_en_retard)
        marches_acheves_count = derniers_avancements.filter(situation_w='Acheve').count()

        glissements_2026 = TravauxGlisse.objects.filter(annee_report=2026)
        reliquat_total_2026 = glissements_2026.aggregate(total=Sum('montant_reliquat'))['total'] or 0
        auc_obtenues = glissements_2026.filter(auc='Obtenue').count()
        auc_en_attente = glissements_2026.filter(auc='En attente').count()
        total_auc = auc_obtenues + auc_en_attente
        auc_pct = round((auc_obtenues / total_auc * 100) if total_auc > 0 else 0, 1)

        # 3. Matrice de financement croisée
        financements = ['RPI', 'FR', 'FIN_EX', 'AUTRE']
        etats = ['En_ph', 'En_passation', 'En_cours', 'Arrete', 'Acheve']
        recap_financement = []
        total_global_details = {etat: 0 for etat in etats}
        total_global_marches = 0
        total_global_retard = 0

        for fin in financements:
            ligne = {
                'type': fin,
                'details': {},
                'total': 0,
                'retard': 0
            }
            av_fin = derniers_avancements.filter(marche__financement=fin)
            for etat in etats:
                count = av_fin.filter(situation_w=etat).count()
                ligne['details'][etat] = count
                ligne['total'] += count
                total_global_details[etat] += count

            retard_count = sum(1 for av in av_fin if av.est_en_retard)
            ligne['retard'] = retard_count
            total_global_retard += retard_count
            total_global_marches += ligne['total']
            recap_financement.append(ligne)

        recap_financement.append({
            'type': 'TOTAL GLOBAL',
            'details': total_global_details,
            'total': total_global_marches,
            'retard': total_global_retard
        })

        # 4. Statistiques des Bacs de traversée
        bacs = Bac.objects.all()
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

        return Response({
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
        })


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

        return queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MarcheWriteSerializer
        if self.action == 'retrieve':
            return MarcheDetailSerializer
        return MarcheListSerializer


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