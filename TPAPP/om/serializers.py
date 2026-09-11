from rest_framework import serializers
from .models import Mission, Missionnaire, Vehicle, Personneltp, DirectionTP, CompteAgent
from django.db.models import Max
from django.contrib.auth.models import User

class DirectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectionTP
        fields = ["id", "DENOMINATION", "SIGLE"]

class DirectionReadOnlySerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectionTP # Assurez-vous que le modèle Direction est importé
        fields = ['id', 'SIGLE', 'DENOMINATION']

class PersonneltpSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personneltp
        fields = ["id", "IM", "Nom_prenom"]


class VehicleSerializer(serializers.ModelSerializer):
    last_mission_end = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = ["id", "Matricule", "marque", "last_mission_end"]

    def get_last_mission_end(self, obj):
        last = obj.missions.aggregate(last_end=Max("date_arrivee"))
        return last.get("last_end")


class MissionnaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Missionnaire
        fields = ["id", "IM", "fonction_mission"]


class MissionSerializer(serializers.ModelSerializer):
    missionnaires = MissionnaireSerializer(many=True)

    class Meta:
        model = Mission
        fields = [
            "id",
            "date_depart",
            "date_arrivee",
            "Motif",
            "lieu",
            "use_vehicle_administratif",
            "vehicule",
            "direction_rattache",
            "missionnaires",
        ]

    def create(self, validated_data):
        missionnaires_data = validated_data.pop("missionnaires")
        mission = Mission.objects.create(**validated_data)

        for m_data in missionnaires_data:
            Missionnaire.objects.create(Mission=mission, **m_data)

        return mission

    def update(self, instance, validated_data):
        missionnaires_data = validated_data.pop("missionnaires", [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Clear & recreate
        instance.missionnaires.all().delete()
        for m_data in missionnaires_data:
            Missionnaire.objects.create(Mission=instance, **m_data)

        return instance

# -----------------------------------
# A. Sérialiseur de Base pour l'Utilisateur Django (lecture seule)
# -----------------------------------
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('username', 'email')
        read_only_fields = ('username', 'email') # L'email et l'username ne sont généralement pas modifiables ici

# -----------------------------------
# B. Sérialiseur de Base pour le Personnel (lecture seule)
# -----------------------------------
class PersonnelProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Personneltp
        fields = ('Nom_prenom', 'IM', 'Fonction') # Ajoutez les champs que vous voulez afficher
        read_only_fields = fields


# -----------------------------------
# C. Sérialiseur Principal pour le Profil Agent (CORRIGÉ)
# -----------------------------------
class AgentProfileSerializer(serializers.ModelSerializer):
    # Ces champs sont définis ici comme imbriqués ou calculés
    user = UserSerializer(read_only=True)
    personnel = PersonnelProfileSerializer(read_only=True)
    direction = DirectionReadOnlySerializer(read_only=True)
    
    # Champ calculé pour l'URL de l'image (nécessaire pour l'affichage Next.js)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = CompteAgent
        
        # 🟢 CORRECTION : Déclaration explicite de l'attribut 'fields'
        fields = [
            'id', 
            'user', 
            'personnel', # Inclus pour la récupération (read)
            'direction', 
            'image_url', 
            'profile_image' # Le champ réel où l'image est stockée/mise à jour
        ]
        
        # Le serializer gère les mises à jour pour tous les champs non 'read_only'
        # On rend les champs relationnels complexes en lecture seule,
        # plus l'ID et le champ 'personnel' qui ne doit pas être modifiable.
        read_only_fields = (
            'id', 
            'user', 
            'personnel',
            'direction', # Le serializer imbriqué est déjà en read_only=True, mais c'est plus clair de le mettre ici aussi
            'image_url' # C'est un SerializerMethodField, donc toujours en lecture seule
        )
    
    def get_image_url(self, obj):
        # ... (Logique inchangée)
        if obj.profile_image and obj.profile_image.name:
            return obj.profile_image.url
        return None