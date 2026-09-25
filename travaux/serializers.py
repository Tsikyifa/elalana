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

    class Meta:
        model = Marche
        fields = ['id', 'axe_designation', 'resume', 'financement', 'dernier_etat', 'region']

    def get_dernier_etat(self, obj):
        # Récupère le dernier avancement grâce à l'ordering=['-date_avancement']
        last_av = obj.avancements.first()
        if last_av:
            return AvancementMiniSerializer(last_av).data
        return {"avancement_physique": 0, "avancement_financier": 0, "avancement_temporel": 0}