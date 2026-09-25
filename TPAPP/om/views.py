from rest_framework import viewsets, generics, parsers
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from datetime import datetime, timedelta # Importation nécessaire pour le calcul de durée
from django.db.models import Q, Max
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm, inch
from reportlab.pdfbase import pdfmetrics

from reportlab.pdfbase.ttfonts import TTFont

from .permissions import CanEnterMissionData

from django.contrib.staticfiles.finders import find
import os
from django.conf import settings

from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors

from django_filters.rest_framework import DjangoFilterBackend #

import locale # NOUVEL IMPORT

from .models import Mission, Vehicle, Personneltp, DirectionTP, Missionnaire
from .serializers import (
    MissionSerializer,
    VehicleSerializer,
    PersonneltpSerializer,
    DirectionSerializer,
    AgentProfileSerializer
)


class MissionViewSet(viewsets.ModelViewSet):
    queryset = Mission.objects.all().order_by("-date_depart")
    serializer_class = MissionSerializer
    permission_classes = [IsAuthenticated]


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated]


class PersonneltpViewSet(viewsets.ModelViewSet):
    queryset = Personneltp.objects.all()
    serializer_class = PersonneltpSerializer
    permission_classes = [IsAuthenticated]


class DirectionViewSet(viewsets.ModelViewSet):
    queryset = DirectionTP.objects.all()
    serializer_class = DirectionSerializer
    permission_classes = [IsAuthenticated]


# ---------------------------
#   CHECK DISPONIBILITÉ API
# ---------------------------
class CheckDisponibiliteAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):

        date_depart = request.data.get("date_depart")
        date_arrivee = request.data.get("date_arrivee")
        direction_id = request.data.get("direction_id")
        raw_vehicle = request.data.get("use_vehicle_administratif", False)

        # Convertir bool correctement
        use_vehicle = str(raw_vehicle).lower() in ["true", "1", "yes", "on"]

        # Convertir dates
        D1 = datetime.strptime(date_depart, "%Y-%m-%d").date()
        D2 = datetime.strptime(date_arrivee, "%Y-%m-%d").date()

        # -------------------------------
        # 1. Missionnaires disponibles
        # -------------------------------
        missionnaires_occupe = Missionnaire.objects.filter(
            Mission__date_depart__lte=D2,
            Mission__date_arrivee__gte=D1
        ).values_list("IM_id", flat=True)

        missionnaires_dispo = Personneltp.objects.exclude(id__in=missionnaires_occupe)

        serialized_missionnaires = PersonneltpSerializer(missionnaires_dispo, many=True).data

        # -------------------------------
        # 2. Véhicules disponibles
        # -------------------------------
        vehicules_serialized = []

        if use_vehicle:

            occupied_vehicles = Mission.objects.filter(
                vehicule__isnull=False,
                date_depart__lte=D2,
                date_arrivee__gte=D1
            ).values_list("vehicule_id", flat=True)

            vehicules_dispo = Vehicle.objects.filter(
                direction_rattache_id=direction_id
            ).exclude(id__in=occupied_vehicles)

            vehicules_serialized = VehicleSerializer(vehicules_dispo, many=True).data

        return Response({
            "missionnaires": serialized_missionnaires,
            "vehicules": vehicules_serialized
        })



class MissionViewSet(viewsets.ModelViewSet):
    # 1. Ajoutez le backend de filtre
    filter_backends = [DjangoFilterBackend]
    
    # 2. Spécifiez les champs sur lesquels le filtre est autorisé
    # Le nom de ce champ doit correspondre exactement au champ du modèle Mission.
    # Ici, nous utilisons 'direction_rattache' pour correspondre à votre requête front-end.
    filterset_fields = ['direction_rattache']
    
    queryset = Mission.objects.all()
    serializer_class = MissionSerializer
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, CanEnterMissionData]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    @action(detail=True, methods=["get"], url_path="pdf")
    def generate_pdf(self, request, pk=None):  # <-- utiliser pk, pas id
        """
        Génère le PDF d'une mission et retourne l'URL.
        """
        mission = get_object_or_404(Mission, id=pk)

        # Authorization: allow staff or users from the same direction
        user_is_allowed = False
        if request.user.is_authenticated:
            if request.user.is_staff or request.user.is_superuser:
                user_is_allowed = True
            else:
                profile = getattr(request.user, 'agent_profile', None)
                if profile and profile.direction == mission.direction_rattache:
                    user_is_allowed = True

        if not user_is_allowed:
            return Response({'detail': 'Forbidden'}, status=403)

        try:
            pdf_path = generate_mission_pdf(mission)
        
        # 1. Obtenir le chemin relatif au MEDIA_ROOT (ex: 'pdf/mission_1.pdf')
        #    Cette méthode garantit d'avoir des barres obliques Unix
            relative_path = os.path.relpath(pdf_path, settings.MEDIA_ROOT).replace("\\", "/")
            
            # 2. Construire l'URL relative à la racine du site (ex: '/media/pdf/mission_1.pdf')
            pdf_url = settings.MEDIA_URL.rstrip('/') + '/' + relative_path
            
            # 3. Construire l'URL complète avec le domaine (nécessaire pour Next.js)
            pdf_full_url = request.build_absolute_uri(pdf_url)
            
            # Retourner l'URL complète
            return Response({"pdf": pdf_full_url})
        except Exception as e:
            import traceback
            print(traceback.format_exc())
            return Response({"error": str(e)}, status=500)

# --- Gestion de la locale pour la date en Français ---
# (Ce bloc est correct pour le format de date)
try:
    # Tenter avec la locale la plus courante
    locale.setlocale(locale.LC_TIME, 'fr_FR.utf8') 
except locale.Error:
    try:
        # Tenter avec des alternatives
        locale.setlocale(locale.LC_TIME, 'fr_FR')
    except locale.Error:
        try:
            locale.setlocale(locale.LC_TIME, 'fra')
        except locale.Error:
            pass 

# --- Configuration police ---
# Initialisation par défaut
FONT_NAME = 'Helvetica'
FONT_NAME_BOLD = 'Helvetica-Bold'

# Bloc d'enregistrement des polices Arial pour la gestion des accents
try:
    # Les chemins des polices dépendent de votre configuration Django/OS
    arial_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Arial.ttf') 
    arial_bold_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Arialbd.ttf')
    
    if os.path.exists(arial_path) and os.path.exists(arial_bold_path):
        # Enregistrement des polices TTF ReportLab
        pdfmetrics.registerFont(TTFont('Arial', arial_path))
        pdfmetrics.registerFont(TTFont('Arial-Bold', arial_bold_path))
        
        # Mise à jour des variables pour utiliser les polices TTF enregistrées
        FONT_NAME = 'Arial' 
        FONT_NAME_BOLD = 'Arial-Bold'
    else:
        # Avertissement si les polices personnalisées sont introuvables
        pass
except Exception as e:
    # Gestion des erreurs d'enregistrement de police
    pass
# --- Configurations Globales (Inchangées) ---
LOGO_CENTRAL_FILENAME = 'image/logoAvant.jpg' 
LOGO_CENTRAL_WIDTH = 1.2 * inch 
LOGO_CENTRAL_HEIGHT = 1.2 * inch
LOGO_TP_FILENAME = 'image/logoMTP.jpg'
LOGO_TP_WIDTH = 0.8 * inch 
LOGO_TP_HEIGHT = 0.8 * inch
MARGIN = 0.7 * inch
TOP_TEXT_OFFSET = 1.2 * inch
LEFT_COLUMN_WIDTH = 3.5 * inch
LEFT_COLUMN_START_X = MARGIN 
CENTER_OF_LEFT_COLUMN = LEFT_COLUMN_START_X + (LEFT_COLUMN_WIDTH / 2)
RIGHT_MARGIN_X = A4[0] - MARGIN 

# NOUVELLES CONSTANTES POUR L'ALIGNEMENT EN DEUX COLONNES
LABEL_START_X = MARGIN                   
CONTENT_START_X = MARGIN + 2.5 * inch  
# NOUVELLE CONSTANTE : Décalage à partir de la marge droite pour le cachet (1.5 inch)
STAMP_OFFSET = 1.5 * inch  

# Fonction utilitaire pour dessiner une ligne de texte soulignée (Inchangée)
def draw_underlined_string(canvas_obj, x, y, text, font_name, font_size):
    canvas_obj.drawString(x, y, text)
    text_width = canvas_obj.stringWidth(text, font_name, font_size)
    canvas_obj.line(x, y - 2, x + text_width, y - 2)

def generate_mission_pdf(mission):
    width, height = A4
    LEFT_TEXT_START_Y = height - TOP_TEXT_OFFSET

    # --- 1. PRÉPARATION DU FICHIER PDF ---
    pdf_dir = os.path.join(settings.MEDIA_ROOT, "pdf")
    os.makedirs(pdf_dir, exist_ok=True)
    pdf_path = os.path.join(pdf_dir, f"mission_{mission.id}.pdf")

    c = canvas.Canvas(pdf_path, pagesize=A4, bottomup=1, encoding='utf-8') 
    
    # ... (LOGOS et EN-TÊTE GAUCHE inchangés) ...

    logo_central_path = find(LOGO_CENTRAL_FILENAME)
    y_after_logo_central = height - TOP_TEXT_OFFSET

    if logo_central_path:
        x_pos_centered = (width - LOGO_CENTRAL_WIDTH) / 2
        y_pos_top = height - LOGO_CENTRAL_HEIGHT 
        c.drawImage(logo_central_path, x_pos_centered, y_pos_top, width=LOGO_CENTRAL_WIDTH, height=LOGO_CENTRAL_HEIGHT)
        y_after_logo_central = y_pos_top - MARGIN
    
    logo_tp_path = find(LOGO_TP_FILENAME)
    y_pos_tp = LEFT_TEXT_START_Y - LOGO_TP_HEIGHT - 5 
    if logo_tp_path:
        x_pos_tp_centered = CENTER_OF_LEFT_COLUMN - (LOGO_TP_WIDTH / 2)
        c.drawImage(logo_tp_path, x_pos_tp_centered, y_pos_tp, width=LOGO_TP_WIDTH, height=LOGO_TP_HEIGHT)

    current_y_left = y_pos_tp - 10 
    text_line_height = 12
    
    # Texte administratif
    c.setFont(FONT_NAME_BOLD, 10)
    current_y_left -= text_line_height; c.drawCentredString(CENTER_OF_LEFT_COLUMN, current_y_left, "SECRETARIAT GENERAL")
    current_y_left -= text_line_height; c.drawCentredString(CENTER_OF_LEFT_COLUMN, current_y_left, "**********")
    c.setFont(FONT_NAME_BOLD, 9)
    current_y_left -= text_line_height; c.drawCentredString(CENTER_OF_LEFT_COLUMN, current_y_left, "DIRECTION GENERALE DES TRAVAUX PUBLICS")
    c.setFont(FONT_NAME_BOLD, 10)
    current_y_left -= text_line_height; c.drawCentredString(CENTER_OF_LEFT_COLUMN, current_y_left, "**********")
    
    # Numéro de Mission
    c.setFont(FONT_NAME, 10)
    current_y_left -= (text_line_height + 5)
    annee_mission = mission.date_depart.year
    c.drawCentredString(CENTER_OF_LEFT_COLUMN, current_y_left, f"N° ___ / MTP/SG/DGTP.{annee_mission}")

    # --- 5. TITRE PRINCIPAL (Souligné et Centré) ---
    lowest_header_y = min(y_after_logo_central, current_y_left) 
    y = lowest_header_y - MARGIN 
    
    c.setFont(FONT_NAME_BOLD, 16)
    title_text = "ORDRE DE MISSION"
    draw_underlined_string(c, (width / 2) - (c.stringWidth(title_text, FONT_NAME_BOLD, 16) / 2), y, title_text, FONT_NAME_BOLD, 16)
    y -= 40 

    # --- 6. CONTENU D'ORDRE DE MISSION (Aligné en deux colonnes fixes) ---
    c.setFont(FONT_NAME, 12)
    line_spacing = 20
    
    # Il est ordonné à Messieurs:
    y -= line_spacing
    c.drawString(MARGIN, y, "Il est ordonné à Messieurs :")
    
    # Liste des Missionnaires
    c.setFont(FONT_NAME_BOLD, 12)
    for m in mission.missionnaires.all():
        y -= line_spacing
        c.drawString(MARGIN + 20, y, f"- {m.IM.Nom_prenom}, {m.fonction_mission}") 
    
    # Revenir à la police normale pour les labels
    c.setFont(FONT_NAME, 12)
    y -= line_spacing * 1.5 
    
    # --- DE SE RENDRE A : (Destination) ---
    label_destination = "DE SE RENDRE A :"
    destination_text = "Toamasina et Foul Pointe" 
    draw_underlined_string(c, LABEL_START_X, y, label_destination, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, destination_text) 

    # --- MOTIFS : ---
    y -= line_spacing
    label_motifs = "MOTIFS :"
    draw_underlined_string(c, LABEL_START_X, y, label_motifs, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, mission.Motif) 

    # --- MOYENS DE DEPLACEMENT : ---
    y -= line_spacing
    label_moyens = "MOYENS DE DEPLACEMENT :"
    vehicule_info = f"véhicules administratifs ({mission.vehicule.Matricule})" if mission.vehicule else "véhicules administratifs (Aucun)"
    draw_underlined_string(c, LABEL_START_X, y, label_moyens, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, vehicule_info)
    
    # --- DUREE : (Calculé) ---
    y -= line_spacing
    
    if mission.date_arrivee and mission.date_depart:
        duration_delta: timedelta = mission.date_arrivee - mission.date_depart
        duree_jours = (duration_delta.days + 1) 
        duree_finale = f" {duree_jours} Jour{'s' if duree_jours > 1 else ''}"
    else:
        duree_finale = "Non spécifiée"
        
    label_duree = "DUREE "
    draw_underlined_string(c, LABEL_START_X, y, label_duree, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, duree_finale)
    
    # --- DATE DE DEPART : ---
    y -= line_spacing
    label_depart = "DATE DE DEPART :"
    date_depart_formatee = mission.date_depart.strftime("%d/%m/%Y") 
    draw_underlined_string(c, LABEL_START_X, y, label_depart, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, date_depart_formatee) 
    
    # --- DATE D’ARRIVEE : ---
    y -= line_spacing
    label_arrivee = "DATE D’ARRIVEE :"
    date_arrivee_formatee = mission.date_arrivee.strftime("%d/%m/%Y") 
    draw_underlined_string(c, LABEL_START_X, y, label_arrivee, FONT_NAME, 12)
    c.drawString(CONTENT_START_X, y, date_arrivee_formatee)
    
    y -= line_spacing
    # Coordonnée Y finale du contenu de la mission (avec une petite marge)
    y_content_end = y - line_spacing * 2
    
    # --- 7. SIGNATURE (Centrée et sans date) ---
    
    # Position minimale pour la signature (0.5 inch du bas)
    y_signature_min = MARGIN + 0.5 * inch 
    
    y_target_after_content = y_content_end - 50 
    y_signature_final = max(y_target_after_content, y_signature_min) 

    # Position Y pour la fonction du DG (point le plus bas de la signature)
    y_func = y_signature_final 
    # Position Y pour le lieu (Antananarivo) (50 points au-dessus de la fonction)
    y_lieu = y_func + 20 
    
    # CALCUL DE LA POSITION X DÉCALÉE :
    X_RIGHT_ADJUSTED = RIGHT_MARGIN_X - STAMP_OFFSET 

    STAMP_OFFSET_k = 1.0 * inch
    X_RIGHT_ADJUSTED_ = A4[0] - MARGIN
  

    # Antananarivo (Aligné à droite sur la position décalée X_RIGHT_ADJUSTED)
    c.setFont(FONT_NAME, 12)
    c.drawRightString(X_RIGHT_ADJUSTED, y_lieu, "Antananarivo, le")
    
    # LE DIRECTEUR GENERAL DES TRAVAUX PUBLICS
    c.setFont(FONT_NAME_BOLD, 12)
    # Alignement à droite sur la position décalée X_RIGHT_ADJUSTED
    c.drawRightString(X_RIGHT_ADJUSTED_, y_func, "LE DIRECTEUR GENERAL DES TRAVAUX PUBLICS")
    
    c.showPage()
    c.save()
    print(pdf_path)
    return pdf_path


class UserProfileAPIView(generics.RetrieveUpdateAPIView):
    """
    Récupère (GET) et met à jour (PATCH) le profil (CompteAgent) de l'utilisateur connecté.
    Gère la mise à jour de l'image via multipart/form-data.
    """
    serializer_class = AgentProfileSerializer
    permission_classes = [IsAuthenticated]
    
    # Permet de recevoir les données de formulaire (texte) et les fichiers (image)
    parser_classes = (parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser)

    def get_object(self):
        """
        Retourne l'objet CompteAgent lié à l'utilisateur connecté (request.user).
        """
        # La relation OneToOne est accessible via related_name='agent_profile'
        return self.request.user.agent_profile

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        data = serializer.data
        
        # Le serializer renvoie juste le chemin /media/..., 
        # on complète l'URL si l'image est présente pour Next.js.
        if data.get('image_url'):
            relative_path = data['image_url']
            # Construire l'URL absolue (y compris le domaine)
            data['image_url'] = request.build_absolute_uri(relative_path)

        return Response(data)

    def partial_update(self, request, *args, **kwargs):
        # Utilisez partial_update pour gérer PATCH (mise à jour partielle)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        # Répéter la logique d'URL absolue après la sauvegarde
        data = serializer.data
        if data.get('image_url'):
            relative_path = data['image_url']
            data['image_url'] = request.build_absolute_uri(relative_path)
            
        return Response(data)