from django.db import models
from django.contrib.auth.models import User
# Create your models here.

from datetime import datetime
class Direction(models.Model):

    code = models.CharField(max_length=20, unique=True)

    nom = models.CharField(max_length=255)

    def __str__(self):
        return f"{self.code} - {self.nom}"


class DemandeAudience(models.Model):

    STATUT_CHOICES = [
        ('RECU', 'Reçu'),
        ('EN_ETUDE', 'En étude'),
        ('PROGRAMME', 'Programmé'),
        ('ACCEPTE', 'Accepté'),
        ('REPORTE', 'Reporté'),
        ('STANDBY', 'Stand By'),
        ('REDIRIGE', 'Redirigé'),
        ('REFUSE', 'Refusé'),
        ('TRAITE', 'Traité'),
    ]

    numero = models.CharField(
        max_length=30,
        unique=True,
        editable=False
    )

    # Informations demandeur
    nom_demandeur = models.CharField(
        max_length=255
    )

    organisme = models.CharField(
        max_length=255,
        blank=True
    )

    fonction = models.CharField(
        max_length=255,
        blank=True
    )

    telephone = models.CharField(
        max_length=20
    )

    email = models.EmailField(
        blank=True
    )

    adresse = models.TextField(
        blank=True
    )

    # Objet de la demande
    objet = models.TextField()

    # Date souhaitée par le demandeur
    date_souhaitee = models.DateField(
        null=True,
        blank=True
    )

    heure_souhaitee = models.TimeField(
        null=True,
        blank=True
    )

    # Programmation réelle décidée par le cabinet
    date_audience = models.DateTimeField(
        null=True,
        blank=True
    )

    date_fin_audience = models.DateTimeField(
        null=True,
        blank=True
    )

    observation_audience = models.TextField(
        blank=True
    )

    # Suivi
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='RECU'
    )

    # Redirection
    direction_redirigee = models.ForeignKey(
        Direction,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    motif_redirection = models.TextField(
        blank=True
    )

    date_redirection = models.DateTimeField(
        null=True,
        blank=True
    )

    # Refus
    motif_refus = models.TextField(
        blank=True
    )

    date_refus = models.DateTimeField(
        null=True,
        blank=True
    )

    # Stand By
    motif_standby = models.TextField(
        blank=True
    )

    date_standby = models.DateTimeField(
        null=True,
        blank=True
    )

    # Réception
    date_reception = models.DateTimeField(
        auto_now_add=True
    )

    date_modification = models.DateTimeField(
        auto_now=True
    )

    # Utilisateurs
    cree_par = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='demandes_creees'
    )

    traite_par = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name='demandes_traitees'
    )

    def save(self, *args, **kwargs):

        if not self.numero:

            annee = timezone.now().year

            dernier = (
                DemandeAudience.objects
                .filter(numero__startswith=f"AUD-{annee}")
                .count() + 1
            )

            self.numero = (
                f"AUD-{annee}-{dernier:05d}"
            )

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.numero} - {self.nom_demandeur}"

    class Meta:
        ordering = ['-date_reception']
        verbose_name = "Demande d'audience"
        verbose_name_plural = "Demandes d'audience"

class BlocageAgenda(models.Model):

    debut = models.DateTimeField()

    fin = models.DateTimeField()

    motif = models.CharField(
        max_length=255
    )

    cree_par = models.ForeignKey(
        User,
        on_delete=models.PROTECT
    )

class Historique(models.Model):

    date_action = models.DateTimeField(
        auto_now_add=True
    )

    utilisateur = models.ForeignKey(
        User,
        on_delete=models.PROTECT
    )

    action = models.CharField(
        max_length=255
    )

    objet = models.CharField(
        max_length=255
    )

class ReportAudience(models.Model):

    demande = models.ForeignKey(
        DemandeAudience,
        on_delete=models.CASCADE,
        related_name='reports'
    )

    ancienne_date = models.DateTimeField()

    nouvelle_date = models.DateTimeField()

    motif = models.TextField()

    date_report = models.DateTimeField(
        auto_now_add=True
    )

    reporte_par = models.ForeignKey(
        User,
        on_delete=models.PROTECT
    )

    def __str__(self):
        return f"Report - {self.demande.numero}"
    
class PieceJointe(models.Model):

    demande = models.ForeignKey(
        DemandeAudience,
        on_delete=models.CASCADE,
        related_name='pieces'
    )

    fichier = models.FileField(
        upload_to='audiences/'
    )

    description = models.CharField(
        max_length=255,
        blank=True
    )
    
    
    
