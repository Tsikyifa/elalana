from django.db import models
import random
import uuid
from django.contrib.auth.models import User

# Générateur d'immatricule
def generate_immatricule():
    return random.randint(100000, 999999)

class DirectionTP(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    DENOMINATION = models.CharField(max_length=100)
    SIGLE = models.CharField(max_length=20)
    hierarchie = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sous_directions'
    )

    def __str__(self):  # Correction __str__ au lieu de _str_
        return self.DENOMINATION


class Personneltp(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    IM = models.IntegerField(unique=True, default=generate_immatricule)
    Nom_prenom = models.CharField(max_length=250)
    Fonction = models.CharField(max_length=250)
    direction = models.ForeignKey(
        DirectionTP,
        on_delete=models.CASCADE,
        related_name='personnels'
    )

    def __str__(self):
        return f"{self.Nom_prenom} ({self.IM})"


class Vehicle(models.Model):
    CONDITION_CHOICES = [
        ('Bon', 'Bon état'),
        ('Moyen', 'À surveiller'),
        ('Mauvais', 'Réparation nécessaire'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    matricule = models.CharField(max_length=50, unique=True,null=True)
    marque = models.CharField(max_length=100)
    direction_rattache = models.ForeignKey(
        'DirectionTP', 
        on_delete=models.CASCADE, 
        related_name='vehicles'
    )
    
    # État technique du véhicule
    etat_technique = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='Bon')
    elements_a_reparer = models.TextField(blank=True, null=True, help_text="Listez les pièces ou problèmes ici")

    def __str__(self):
        return f"{self.marque} - {self.matricule}"

    @property
    def dernier_statut(self):
        # Récupère la dernière mise à jour de l'emplacement
        return self.stats.order_by('-date_maj').first()


class Mission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    date_depart = models.DateField()
    date_arrivee = models.DateField()
    Motif = models.TextField()
    lieu = models.CharField(max_length=250,  default="")
    use_vehicle_administratif = models.BooleanField(default=True)
    vehicule = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='missions'
    )
    direction_rattache = models.ForeignKey(
        DirectionTP,
        on_delete=models.CASCADE,
        related_name='mission_vehicule',
        blank=True,
        null=True
    )
    def __str__(self):
        return f"Mission {self.id} du {self.date_depart}"


class Missionnaire(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    Mission = models.ForeignKey(
        Mission,
        on_delete=models.CASCADE,
        related_name="missionnaires"
    )
    IM = models.ForeignKey(
        Personneltp,
        on_delete=models.CASCADE,
        related_name='missions'
    )
    fonction_mission = models.CharField(max_length=250, blank=True, null= True)
    def __str__(self):
        return f"{self.IM.Nom_prenom} - Mission {self.Mission.id}"


class CompteAgent(models.Model):
    """
    Classe de profil liant un utilisateur de Django (pour l'authentification) 
    à un employé (Personneltp) et, indirectement, à sa DirectionTP.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # 1. Lien vers l'utilisateur (Authentication)
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='agent_profile',
        verbose_name="Compte utilisateur Django"
    )
    
    # 2. Lien vers le personnel (Données métiers)
    personnel = models.OneToOneField(
        Personneltp,
        on_delete=models.CASCADE, 
        related_name='compte_agent',
        verbose_name="Informations Personnel TP"
    )
    # --- NOUVEAU CHAMP POUR L'IMAGE ---
    profile_image = models.ImageField(
        upload_to='profiles/images/',
        null=True,
        blank=True,
        default='profiles/images/default.png' # Image par défaut optionnelle
    )

    # --- NOUVEL ATTRIBUT D'AUTORISATION ---
    peut_saisir_donnees = models.BooleanField(
        default=False,
        verbose_name="Peut saisir des données/missions",
        help_text="Cocher si cet utilisateur est autorisé à créer ou modifier des missions."
    )
    
    # Champ existant (si déjà présent)
    est_gestionnaire_mission = models.BooleanField(
        default=False,
        help_text="Indique si cet agent a les droits de créer et valider des missions."
    )
    # -------------------------------------
    
    def __str__(self):
        return f"Profil de {self.user.username} - {self.personnel.Nom_prenom}"
        
    @property
    def direction(self):
        """ Propriété pour accéder facilement à la direction via le personnel lié. """
        return self.personnel.direction
    

class VehicleStat(models.Model):
    SITUATION_CHOICES = [
        ('En_mission', 'En Mission'),
        ('Au_garage', 'Garage'),
        ('Parking', 'Au Parking / Disponible'),
        ('Autre', 'Autre'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicule = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name='stats' # Changé de 'missions' à 'stats' pour plus de clarté
    )
    situation = models.CharField(max_length=20, choices=SITUATION_CHOICES, default='Parking')
    emplacement_actuel = models.CharField(max_length=255, help_text="Ville, garage spécifique ou bureau")
    missionnaire = models.CharField(max_length=250, null=True, blank=True)
    observation = models.TextField(blank=True, null=True)
    
    # Dates de suivi
    date_maj = models.DateTimeField(auto_now_add=True) # Date automatique à la création

    class Meta:
        ordering = ['-date_maj']
        verbose_name = "Suivi de véhicule"

    def __str__(self):
        return f"{self.vehicule.matricule} - {self.situation} ({self.date_maj.strftime('%d/%m/%Y')})"
