from django.db import models
from django.contrib.auth.models import User
from travaux.models import Localisation
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError

class Intervenant(models.Model):
    nom = models.CharField(max_length=255)
    fonction = models.CharField(max_length=255, blank=True, null=True)
    service = models.CharField(max_length=255, blank=True, null=True)

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.nom
    
class Doleance(models.Model):
    TYPE_AUTORITE = [
        ('depute', 'DEPUTE'),
        ('cr', 'CHEF DE REGION'),
        ('maire', 'MAIRE'),
        ('autre', 'Autre'),
    ]

    STATUT = [
        ('en_attente', 'En attente'),
        ('en_cours', 'En cours de traitement'),
        ('traite', 'Traité'),
        ('classe', 'Classé'),
        ('rejete', 'Rejeté'),
    ]
    #region = models.CharField(choices=Localisation.REGION_CHOICES, blank=True,null=True, max_length=30)
    district = models.ForeignKey(Localisation, on_delete=models.CASCADE,related_name='districts_doleances')
    titre = models.CharField(max_length=255)
    origin = models.CharField("En provenance De : ", blank=True, null=True)
    description = models.TextField()
    type_autorite = models.CharField(max_length=20, choices=TYPE_AUTORITE)
    auteur = models.CharField("Auteur de la demande",max_length=255)  # nom de l’autorité
    
    date_obtention = models.DateTimeField(null=True, blank=True)
    
    statut = models.CharField(max_length=20, choices=STATUT, default='en_attente')


    responsable_insert = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)


    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.titre} - {self.type_autorite} ({self.auteur} → {self.date_obtention})"

class EtapeTraitement(models.Model):
    doleance = models.ForeignKey(Doleance, on_delete=models.CASCADE, related_name='etapes')

    titre = models.CharField(max_length=255)
    description = models.TextField()

    date_debut = models.DateTimeField()
    date_fin = models.DateTimeField(null=True, blank=True)

    effectue_par = models.ForeignKey(Intervenant, on_delete=models.CASCADE, related_name='intervenants_Dol')

    est_terminee = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')
    def __str__(self):
        return f"{self.titre} - {self.doleance.titre}"
    def clean(self):
        if self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError("La date de fin doit être après la date de début")

class Promesse(models.Model):
    TYPE_PROMESSE = [
        ('presidentielle', 'Présidentielle'),
        ('parlementaire', 'Parlementaire'),
        ('ministerielle', 'Ministérielle'),
    ]

    STATUT = [
        ('non_demarre', 'Non démarré'),
        ('en_cours', 'En cours'),
        ('realise', 'Réalisé'),
        ('retard', 'En retard'),
        ('abandonne', 'Abandonné'),
    ]

    district = models.ForeignKey(Localisation, on_delete=models.CASCADE,related_name='districts_promesse')
    lieu = models.CharField("LIEU", blank=True, null=True)
    titre = models.CharField(max_length=255)
    description = models.TextField()
    observation = models.TextField(null=True, blank=True)
    type_promesse = models.CharField(max_length=20, choices=TYPE_PROMESSE)

    date_annonce = models.DateField()
    date_prevue = models.DateField(null=True, blank=True)

    statut = models.CharField(max_length=20, choices=STATUT, default='non_demarre')

    taux_realisation = models.FloatField(default=0)  # en %

    responsable_insert = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titre
    
class EtapePromesse(models.Model):
    promesse = models.ForeignKey(Promesse, on_delete=models.CASCADE, related_name='etapes')

    titre = models.CharField(max_length=255)
    description = models.TextField()

    date = models.DateField()
    effectue_par = models.ForeignKey(Intervenant, on_delete=models.CASCADE, related_name='intervenants_Prom')
    progression = models.FloatField(default=0)  # %
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name='+')

    def __str__(self):
        return f"{self.titre} - {self.promesse.titre}"
    
class PieceJointe(models.Model):
    fichier = models.FileField(upload_to='doleances/')
    description = models.CharField(max_length=255, blank=True)
    doleance = models.ForeignKey(Doleance, on_delete=models.CASCADE, related_name='pieces')