from rest_framework import serializers
from .models import Marche, Avancement, Axe

class AvancementMiniSerializer(serializers.ModelSerializer):
    avancement_temporel = serializers.ReadOnlyField() # La @property du modèle

    class Meta:
        model = Avancement
        fields = ['avancement_physique', 'avancement_financier', 'avancement_temporel']

class MarcheListSerializer(serializers.ModelSerializer):
    axe_designation = serializers.CharField(source='axe.designation', read_only=True)
    dernier_etat = serializers.SerializerMethodField()
    region = serializers.ReadOnlyField()

    class Meta:
        model = Marche
        fields = ['id', 'axe_designation', 'resume', 'financement', 'dernier_etat', 'region']

    def get_dernier_etat(self, obj):
        # Utiliser l'avancement précalculé si disponible (évite le N+1)
        # Sinon, retourner à la méthode originale pour la compatibilité
        if hasattr(obj, 'dernier_avancement') and obj.dernier_avancement:
            last_av = obj.dernier_avancement[0] if isinstance(obj.dernier_avancement, list) else obj.dernier_avancement
            return AvancementMiniSerializer(last_av).data

        # Récupère le dernier avancement grâce à l'ordering=['-date_avancement']
        last_av = obj.avancements.first()
        if last_av:
            return AvancementMiniSerializer(last_av).data
        return {"avancement_physique": 0, "avancement_financier": 0, "avancement_temporel": 0}