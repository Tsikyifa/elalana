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
from travaux.models import Localisation


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

