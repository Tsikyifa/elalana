# serializers.py
from rest_framework import serializers
from .models import (
    Intervenant,
    Doleance,
    EtapeTraitement,
    PieceJointe,
    EtapePromesse,
    Promesse
)
from travaux.models import (
    Localisation, Axe, Bac, Marche, PKMarche, Avancement, MediaAvancement, OS,
    TravauxGlisse, ConventionProgramme, MessageMarche
)


class LocalisationSerializer(serializers.ModelSerializer):
    # On peut ajouter un champ calculé pour afficher "District (Région)" dans le frontend
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Localisation
        fields = ['id', 'province', 'region', 'district', 'display_name']

    def get_display_name(self, obj):
        return f"{obj.district} ({obj.region})"

class IntervenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Intervenant
        fields = '__all__'


class EtapeTraitementSerializer(serializers.ModelSerializer):
    effectue_par_detail = IntervenantSerializer(source='effectue_par', read_only=True)

    class Meta:
        model = EtapeTraitement
        fields = '__all__'


class PieceJointeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PieceJointe
        fields = '__all__'


# --- DOLÉANCES ---
class DoleanceSerializer(serializers.ModelSerializer):
    etapes = EtapeTraitementSerializer(many=True, read_only=True)
    pieces = PieceJointeSerializer(many=True, read_only=True)
    district_detail = LocalisationSerializer(source='district', read_only=True)
    
    # On le met en read_only car injecté par perform_create dans la vue
    responsable_insert = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Doleance
        fields = [
            'id', 'district', 'district_detail', 'titre', 'origin', 
            'description', 'type_autorite', 'auteur', 'date_obtention', 
            'statut', 'responsable_insert', 'etapes', 'pieces', 
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        # 1. Créer la doléance normalement
        doleance = super().create(validated_data)
        
        # 2. Récupérer le fichier depuis la requête via le contexte
        request = self.context.get('request')
        if request and request.FILES.get('fichier'):
            fichier_data = request.FILES.get('fichier')
            PieceJointe.objects.create(
                doleance=doleance, 
                fichier=fichier_data,
                description=f"Document scanné pour : {doleance.titre}"
            )
            
        return doleance
    
class EtapePromesseSerializer(serializers.ModelSerializer):
    effectue_par_detail = IntervenantSerializer(source='effectue_par', read_only=True)

    class Meta:
        model = EtapePromesse
        fields = '__all__'

class PromesseSerializer(serializers.ModelSerializer):
    etapes = EtapePromesseSerializer(many=True, read_only=True)
    district_detail = LocalisationSerializer(source='district', read_only=True)
    class Meta:
        model = Promesse
        fields = [
            'id',
            'district', 'district_detail',
            'lieu', 'titre', 'description', 'observation',
            'type_promesse', 'date_annonce', 'date_prevue',
            'statut', 'taux_realisation', 'responsable_insert',
             'etapes',
            'created_at', 'updated_at'
        ]


# --- BACS DE TRAVERSÉE ---
class AxeSerializer(serializers.ModelSerializer):
    """Version allégée de l'Axe, pour alimenter les listes déroulantes."""

    type_axe_display = serializers.CharField(source='get_type_axe_display', read_only=True)

    class Meta:
        model = Axe
        fields = ['id', 'designation', 'type_axe', 'type_axe_display', 'longueur_total']


class BacSerializer(serializers.ModelSerializer):
    # Champs en lecture seule, pratiques pour l'affichage côté frontend
    axe_detail = AxeSerializer(source='axe', read_only=True)
    region_display = serializers.CharField(source='get_region_display', read_only=True)
    etat_bac_display = serializers.CharField(source='get_etat_bac_display', read_only=True)
    etat_financement_display = serializers.CharField(
        source='get_etat_financement_bac_display', read_only=True
    )

    class Meta:
        model = Bac
        # 'axe' reste inscriptible (clé primaire), 'axe_detail' ne l'est pas.
        fields = '__all__'


# --- MARCHÉS, AVANCEMENTS & OS ---
class PKMarcheSerializer(serializers.ModelSerializer):
    # `marche` est géré par le parent `MarcheWriteSerializer.create()` lors
    # de la création des segments. Le marquage en lecture seule évite que DRF
    # exige ce champ lors de la validation des éléments imbriqués.
    marche = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PKMarche
        fields = ['id', 'marche', 'pk_debut', 'pk_fin', 'description']


class OSSerializer(serializers.ModelSerializer):
    type_os_display = serializers.CharField(source='get_type_os_display', read_only=True)
    delai_unit_display = serializers.CharField(source='get_delai_unit_display', read_only=True)

    class Meta:
        model = OS
        fields = [
            'id', 'marche', 'type_os', 'type_os_display',
            'date_os', 'delai_supplementaire', 'delai_unit', 'delai_unit_display',
            'delai_jours_supplementaire', 'os_arret_concerne', 'commentaire'
        ]


EXTENSIONS_IMAGE = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic')


class MediaAvancementSerializer(serializers.ModelSerializer):
    """
    Pièce jointe d'un relevé d'avancement (photo de chantier, PDF…).

    `fichier_url` est une URL absolue : le frontend tourne sur un autre port que
    l'API et ne saurait pas résoudre un chemin relatif `/media/...`.
    """
    fichier_url = serializers.SerializerMethodField()
    est_image = serializers.SerializerMethodField()

    class Meta:
        model = MediaAvancement
        fields = ['id', 'fichier', 'fichier_url', 'legende', 'date_upload', 'est_image']

    def get_fichier_url(self, obj):
        if not obj.fichier:
            return None
        url = obj.fichier.url
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_est_image(self, obj):
        return bool(obj.fichier) and obj.fichier.name.lower().endswith(EXTENSIONS_IMAGE)


class AvancementSerializer(serializers.ModelSerializer):
    situation_w_display = serializers.CharField(source='get_situation_w_display', read_only=True)
    avancement_temporel = serializers.ReadOnlyField()
    est_en_retard = serializers.ReadOnlyField()

    class Meta:
        model = Avancement
        fields = [
            'id', 'marche', 'date_avancement', 'avancement_physique',
            'avancement_financier', 'situation_w', 'situation_w_display',
            'detail_situation', 'observation', 'avancement_temporel', 'est_en_retard'
        ]


class AvancementDetailSerializer(AvancementSerializer):
    """
    Relevé complet, pièces jointes comprises.

    Séparé de `AvancementSerializer` à dessein : `MarcheListSerializer` sérialise
    le dernier relevé de chaque marché, et y joindre les médias déclencherait une
    requête par marché dans la liste.
    """
    medias = MediaAvancementSerializer(many=True, read_only=True)

    class Meta(AvancementSerializer.Meta):
        fields = AvancementSerializer.Meta.fields + ['medias']


class MarcheListSerializer(serializers.ModelSerializer):
    axe_detail = AxeSerializer(source='axe', read_only=True)
    etape_actuelle_display = serializers.CharField(source='get_etape_actuelle_display', read_only=True)
    financement_display = serializers.CharField(source='get_financement_display', read_only=True)
    dernier_avancement = serializers.SerializerMethodField()
    date_demarrage_effective = serializers.ReadOnlyField()
    date_fin_actualisee = serializers.ReadOnlyField()
    longueur_totale = serializers.ReadOnlyField()

    class Meta:
        model = Marche
        fields = [
            'id', 'num_marche', 'axe', 'axe_detail', 'description', 'resume',
            'categorie', 'responsable', 'financement', 'financement_display',
            'detail_financement', 'tiers', 'montant', 'titulaire',
            'region',
            'os_com', 'delai_unit', 'delai_nombre', 'delai_jours',
            'est_anticipe', 'etape_actuelle', 'etape_actuelle_display',
            'dernier_avancement', 'date_demarrage_effective',
            'date_fin_actualisee', 'longueur_totale'
        ]

    def get_dernier_avancement(self, obj):
        last_av = obj.avancements.first()
        if last_av:
            return AvancementSerializer(last_av).data
        return {
            'avancement_physique': 0,
            'avancement_financier': 0,
            'avancement_temporel': 0,
            'situation_w': 'En_cours',
            'situation_w_display': 'En cours',
            'est_en_retard': False,
        }


class MarcheDetailSerializer(MarcheListSerializer):
    segments_pk = PKMarcheSerializer(many=True, read_only=True)
    ordres_service = OSSerializer(many=True, read_only=True)
    avancements = AvancementDetailSerializer(many=True, read_only=True)

    class Meta(MarcheListSerializer.Meta):
        fields = MarcheListSerializer.Meta.fields + ['segments_pk', 'ordres_service', 'avancements']


class MarcheWriteSerializer(serializers.ModelSerializer):
    segments = PKMarcheSerializer(many=True, required=False, write_only=True)
    segments_pk = PKMarcheSerializer(many=True, required=False, write_only=True)
    responsable = serializers.ChoiceField(
        choices=Marche.resp_choice,
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    categorie = serializers.ChoiceField(
        choices=Marche.cat_choice,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    class Meta:
        model = Marche
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy()
        # Normalise les chaînes vides pour les choix optionnels
        if 'responsable' in data and data['responsable'] in ('', None):
            data['responsable'] = None
        if 'categorie' in data and data['categorie'] in ('', None):
            data['categorie'] = None
        if 'num_marche' in data and data['num_marche'] in ('', None):
            data['num_marche'] = None
        return super().to_internal_value(data)

    def create(self, validated_data):
        segments_data = validated_data.pop('segments', None)
        segments_pk_data = validated_data.pop('segments_pk', None)
        all_segments = segments_data or segments_pk_data or []

        # Ensure region empty strings become None
        if 'region' in validated_data and validated_data['region'] == '':
            validated_data['region'] = None

        marche = Marche.objects.create(**validated_data)
        for seg in all_segments:
            PKMarche.objects.create(marche=marche, **seg)
        return marche

    def update(self, instance, validated_data):
        segments_data = validated_data.pop('segments', None)
        segments_pk_data = validated_data.pop('segments_pk', None)
        all_segments = segments_data if segments_data is not None else segments_pk_data

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if all_segments is not None:
            instance.segments_pk.all().delete()
            for seg in all_segments:
                PKMarche.objects.create(marche=instance, **seg)
        return instance


# --- TRAVAUX GLISSÉS ---
class TravauxGlisseSerializer(serializers.ModelSerializer):
    marche_detail = MarcheListSerializer(source='marche', read_only=True)
    axe_detail = AxeSerializer(source='axe', read_only=True)
    auc_display = serializers.CharField(source='get_auc_display', read_only=True)
    passation_display = serializers.CharField(source='get_passation_display', read_only=True)

    class Meta:
        model = TravauxGlisse
        fields = '__all__'


# --- CONVENTIONS PROGRAMMES ---
class ConventionProgrammeSerializer(serializers.ModelSerializer):
    axe_detail = AxeSerializer(source='axe', read_only=True)
    region_display = serializers.CharField(source='get_region_display', read_only=True)
    nature_surface_display = serializers.CharField(source='get_nature_surface_display', read_only=True)

    class Meta:
        model = ConventionProgramme
        fields = '__all__'
        read_only_fields = ['longueur', 'created_at', 'updated_at']


# --- DISCUSSION D'UN MARCHÉ ---
class MessageMarcheSerializer(serializers.ModelSerializer):
    """
    Message du fil de discussion d'un marché.

    `auteur` est en lecture seule : il est injecté par la vue depuis
    `request.user`, le client ne peut donc pas usurper une identité.
    """
    auteur_nom = serializers.SerializerMethodField()
    est_moi = serializers.SerializerMethodField()
    fichier_url = serializers.SerializerMethodField()
    fichier_nom = serializers.SerializerMethodField()
    fichier_taille = serializers.SerializerMethodField()
    est_image = serializers.SerializerMethodField()

    class Meta:
        model = MessageMarche
        fields = [
            'id', 'marche', 'auteur', 'auteur_nom', 'contenu',
            'fichier', 'fichier_url', 'fichier_nom', 'fichier_taille', 'est_image',
            'created_at', 'est_moi'
        ]
        read_only_fields = ['auteur', 'created_at', 'fichier_url', 'fichier_nom', 'fichier_taille', 'est_image']
        extra_kwargs = {
            'contenu': {'required': False, 'allow_blank': True},
            'fichier': {'required': False, 'allow_null': True},
        }

    def validate(self, attrs):
        contenu = attrs.get('contenu', '')
        if isinstance(contenu, str):
            contenu = contenu.strip()
            attrs['contenu'] = contenu
        fichier = attrs.get('fichier')
        if not self.instance and not contenu and not fichier:
            raise serializers.ValidationError("Le message doit comporter du texte ou une pièce jointe.")
        return attrs

    def get_auteur_nom(self, obj):
        return obj.auteur.username if obj.auteur else 'Utilisateur supprimé'

    def get_est_moi(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.auteur_id == request.user.id

    def get_fichier_url(self, obj):
        if not obj.fichier:
            return None
        request = self.context.get('request')
        url = obj.fichier.url
        return request.build_absolute_uri(url) if request else url

    def get_fichier_nom(self, obj):
        if not obj.fichier:
            return None
        import os
        return os.path.basename(obj.fichier.name)

    def get_fichier_taille(self, obj):
        if not obj.fichier:
            return None
        try:
            return obj.fichier.size
        except Exception:
            return None

    def get_est_image(self, obj):
        if not obj.fichier:
            return False
        return obj.fichier.name.lower().endswith(EXTENSIONS_IMAGE)


