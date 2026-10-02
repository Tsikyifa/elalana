# serializers.py

from rest_framework import serializers
from .models import Mission, Missionnaire, Vehicle, Personneltp, DirectionTP
from django.db.models import Max

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    # Vous pouvez ajouter une méthode validate() pour faire l'authentification ici
    # mais pour simplifier, on la garde dans la vue comme vous l'avez fait.


class MissionnaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Missionnaire
        fields = ['id', 'IM', 'fonction_mission']

class MissionSerializer(serializers.ModelSerializer):
    missionnaires = MissionnaireSerializer(many=True)

    class Meta:
        model = Mission
        fields = ['id', 'date_depart', 'date_arrivee', 'Motif', 'use_vehicle_administratif', 'vehicule', 'missionnaires']

    def create(self, validated_data):
        missionnaires_data = validated_data.pop('missionnaires')
        mission = Mission.objects.create(**validated_data)
        for m_data in missionnaires_data:
            Missionnaire.objects.create(Mission=mission, **m_data)
        return mission

    def update(self, instance, validated_data):
        missionnaires_data = validated_data.pop('missionnaires', [])
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Supprimer les anciens missionnaires
        instance.missionnaires.all().delete()
        for m_data in missionnaires_data:
            Missionnaire.objects.create(Mission=instance, **m_data)

        return instance
    
class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['id', 'Matricule', 'marque']

    def get_last_mission_end(self, obj):
        last = obj.missions.aggregate(last_end=Max("date_arrivee"))
        return last.get("last_end")

class PersonneltpSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personneltp
        fields = ['id', 'IM', 'Nom_prenom']

class DirectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectionTP
        fields = ['id', 'DENOMINATION', 'SIGLE']