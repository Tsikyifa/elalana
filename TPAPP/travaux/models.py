from django.db import models
import uuid
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date
from django.core.validators import MaxValueValidator, MinValueValidator
from django.dispatch import receiver
from django.db.models.signals import post_save
#
from django.core.exceptions import ValidationError  # 🔹 si pas déjà importé

from dateutil.relativedelta import relativedelta




class Localisation(models.Model):

    PROVINCE_CHOICES = [
        ('ANTANANARIVO', 'Antananarivo'),
        ('ANTSIRANANA', 'Antsiranana'),
        ('FIANARANTSOA', 'Fianarantsoa'),
        ('MAHAJANGA', 'Mahajanga'),
        ('TOAMASINA', 'Toamasina'),
        ('TOLIARA', 'Toliara'),
    ]

    REGION_CHOICES = [
        ('ANALAMANGA', 'Analamanga'), ('VAKINANKARATRA', 'Vakinankaratra'),
        ('ITASY', 'Itasy'), ('BONGOLAVA', 'Bongolava'),
        ('SAVA', 'Sava'), ('DIANA', 'Diana'),
        ('MATSIATRA_AMBONY', 'Matsiatra Ambony'),
        ('AMORON_I_MANIA', 'Amoron\'i Mania'),
        ('VATOVAVY', 'Vatovavy'),
        ('FITOVINANY', 'Fitovinany'),
        ('IHOROMBE', 'Ihorombe'),
        ('ATSIMO_ATSINANANA', 'Atsimo-Atsinanana'),
        ('BOENY', 'Boeny'),
        ('SOFIA', 'Sofia'),
        ('BETSIBOKA', 'Betsiboka'),
        ('MELAKY', 'Melaky'),
        ('ATSINANANA', 'Atsinanana'),
        ('ALAOTRA_MANGORO', 'Alaotra-Mangoro'),
        ('ANALANJIROFO', 'Analanjirofo'),
        ('ATSIMO_ANDREFANA', 'Atsimo-Andrefana'),
        ('ANDROY', 'Androy'),
        ('ANOSY', 'Anosy'),
        ('MENABE', 'Menabe'),
    ]

    province = models.CharField(max_length=20, choices=PROVINCE_CHOICES)
    region = models.CharField(max_length=30, choices=REGION_CHOICES)
    district = models.CharField(max_length=100)

    class Meta:
        verbose_name = "Localisation (District)"
        verbose_name_plural = "Localisations"
        ordering = ['province', 'region', 'district']

        # 🔹 MODIFICATION (remplace unique_together)
        constraints = [
            models.UniqueConstraint(
                fields=['district', 'region'],
                name='unique_district_region'
            )
        ]

    def __str__(self):
        return f"{self.district} ({self.region})"

class Axe(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    TYPE_AXE = [
        ('RN', 'Route Nationale'),
        ('RR', 'Route Régionale'),
        ('RC', 'Route Communale'),
        ('AU', 'Autre'),
        ('FL', 'FLY OVER'),
        ('PT','PONT'),
    ]

    designation = models.CharField(max_length=255)
    type_axe = models.CharField(max_length=2, choices=TYPE_AXE, default='AU')
    longueur_total = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    
    pk_debut_district = models.ForeignKey(
        Localisation,
        on_delete=models.PROTECT,
        related_name='axes_depart',
        null=True
    )

    pk_fin_district = models.ForeignKey(
        Localisation,
        on_delete=models.PROTECT,
        related_name='axes_fin',
        null=True
    )

    description = models.TextField(blank=True, null=True)
    attache_suivi = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.designation}" #({self.get_type_axe_display()})


class PKDistrict(models.Model):

    axe = models.ForeignKey('Axe', on_delete=models.CASCADE, related_name='segments_districts')

    district = models.ForeignKey(
        Localisation,
        on_delete=models.PROTECT,
        related_name='segments_traverses',
        null=True
    )

    pk_debut = models.DecimalField(max_digits=10, decimal_places=3)
    deb = models.CharField("Lieu Debut",max_length=255,blank=True, null=True)
    pk_fin = models.DecimalField(max_digits=10, decimal_places=3)
    fin = models.CharField("Lieu Fin",max_length=255,blank=True, null=True)
    section = models.CharField("SECTION",max_length=255,null=True, blank=True)
    longueur = models.DecimalField(
        "Longueur Totale (km)", 
        max_digits=10, 
        decimal_places=3,
        default=0, 
        editable=False # On empêche la saisie manuelle
    )
    surfaceChoice = [
        ('RB','RB'),
        ('RT','RT')
    ]
    surface = models.CharField(choices=surfaceChoice, null=True,blank=True)

    def save(self, *args, **kwargs):
        # Calcul automatique de la longueur du tronçon
        self.longueur = abs(self.pk_fin - self.pk_debut)
        super().save(*args, **kwargs)
        # 🔹 AJOUT VALIDATION
    def clean(self):
            # 1. Validation de base (toujours possible)
            if self.pk_debut is not None and self.pk_fin is not None:
                if self.pk_debut >= self.pk_fin:
                    raise ValidationError("Le PK début doit être inférieur au PK fin.")

            # 2. Validation des chevauchements (uniquement si l'axe est déjà sauvé)
            # On vérifie si self.axe existe ET si son ID n'est pas None
            if self.axe and self.axe.pk:
                segments = PKDistrict.objects.filter(
                    axe=self.axe
                ).exclude(id=self.id)

                for segment in segments:
                    if not (self.pk_fin <= segment.pk_debut or self.pk_debut >= segment.pk_fin):
                        raise ValidationError(
                            f"Ce segment ({self.pk_debut}-{self.pk_fin}) chevauche "
                            f"le segment existant ({segment.pk_debut}-{segment.pk_fin})."
                        )
            else:
                # Si on est en train de créer l'Axe, on ne peut pas encore 
                # vérifier les chevauchements en base de données via SQL.
                pass

    class Meta:
        ordering = ['axe', 'pk_debut']

        # 🔹 MODIFICATION
        constraints = [
            models.UniqueConstraint(
                fields=['axe', 'pk_debut'],
                name='unique_pk_debut_par_axe'
            )
        ]

    def __str__(self):
        return f"{self.axe.designation} - {self.district} ({self.pk_debut} → {self.pk_fin})"



class Marche(models.Model):

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    num_marche = models.CharField(max_length=255, blank=True, null=True)
    axe = models.ForeignKey('Axe', on_delete=models.CASCADE, related_name='marches')

    description = models.TextField()
    resume = models.CharField(max_length=255)
    # Définissez les options possibles
    FINANCEMENT_CHOICES = [
        ('Rech_finan','Recherche Financement'),
        ('RPI', 'RPI'),
        ('FIN_EX', 'Fin Ex'),
        ('FR', 'FR'),
        #('FER', 'FER'),
        ('AUTRE', 'Autre'),
    ]
    cat_choice = [
        ("PONT","PONT"),
        ("BACS","BACS"),
        ("VR_DI","VOIES URBAINES ET DES DISTRICTS"),
    ]
    categorie = models.CharField(
        max_length=10, 
        choices=cat_choice,
        blank=True,
        null=True,
    )

    resp_choice = [
        ('AR','AR'),
        ("CCP","CCP"),
        ("DAU","DAU"),
        ("DER","DER"),
        ("DINFRA","DINFRA"),
        ('PACFC','PACFC'),
        ('PCMCI','PCMCI'),
        ("PDDR","PDDR"),
        
    ]
    responsable = models.CharField("Institution Responsable",
        max_length=10, 
        choices=resp_choice,
        blank=True,
        null=True,
    )

    financement = models.CharField(
        max_length=10, 
        choices=FINANCEMENT_CHOICES
    )
    detail_financement = models.CharField(max_length=255, blank=True, null=True)

    tiers = models.CharField(max_length=100)
    montant = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    titulaire = models.CharField(max_length=255)

    os_com = models.DateField(blank=True, null=True)
    DELAI_UNIT_CHOICES = [
        ('JOUR', 'Jour(s)'),
        ('SEMAINE', 'Semaine(s)'),
        ('MOIS', 'Mois'),
    ]
    delai_unit = models.CharField(
        max_length=10, 
        choices=DELAI_UNIT_CHOICES, 
        default='MOIS'
    )
    
    delai_nombre = models.IntegerField(blank=True, null=True)
# 🔹 AJOUT : Le complément en jours
    delai_jours = models.PositiveIntegerField(default=0, verbose_name="Jours supplémentaires")
    # 🔹 Nouveau : Case à cocher pour Marché Anticipé
    est_anticipe = models.BooleanField(
        default=False, 
        verbose_name="Marché Anticipé",
        help_text="Cocher si la procédure est lancée de manière anticipée"
    )

    # 🔹 Mise à jour des étapes pour coller à la réalité administrative
    ETAPE_PASSATION_CHOICES = [
        ('ETUDE', 'En cours d\'Étude / Montage APD'),
        ('VISE_TECH', 'Dossier Visé (Technique)'),
        ('PASSATION', 'EN PASSATION DU MARCHE'),
        ('TEF', 'Transmis pour Examen Financier (TEF)'),
        ('AO_LANCE', 'Appel d\'Offres Lancé'),
        ('EVALUATION', 'En cours d\'Évaluation / Attribution'),
        ('SIGNATURE', 'En cours de Signature / Approbation'),
        ('ATTRIBUE', 'Attribué (En attente OS)'),
        ('EXE', 'En cours d\'Exécution (OS délivré)'),
    ]
    
    etape_actuelle = models.CharField(
        max_length=20, 
        choices=ETAPE_PASSATION_CHOICES, 
        default='EXE'
    )

    # Propriété pour un affichage clair dans l'administration ou les listes
    @property
    def label_complet(self):
        prefix = "[ANTICIPÉ] " if self.est_anticipe else ""
        return f"{prefix}{self.resume}"
    # ============================
    # 🔹 AJOUT 1 : Date fin prévue
    # ============================
    @property
    def date_demarrage_effective(self):
        """Priorité à l'OS de Commencement, sinon utilise le champ os_com."""
        os_debut = self.ordres_service.filter(type_os='COMMENCEMENT').first()
        return os_debut.date_os if os_debut else self.os_com
  

    @property
    def date_fin_actualisee(self):
        """
        Calcule la date de fin réelle en tenant compte du calendrier exact,
        des avenants (unités variables) et des périodes de suspension.
        """
        date_debut = self.date_demarrage_effective
        if not date_debut or (not self.delai_nombre and self.delai_jours == 0):
            return None

        # 1. Calcul de la date de fin contractuelle (Délai initial)
        if self.delai_unit == 'MOIS':
            date_fin = date_debut + relativedelta(months=self.delai_nombre)
        elif self.delai_unit == 'SEMAINE':
            date_fin = date_debut + relativedelta(weeks=self.delai_nombre)
        else:
            date_fin = date_debut + relativedelta(days=self.delai_nombre)

        if self.delai_jours > 0:
            date_fin += relativedelta(days=self.delai_jours)
        # 2. Ajout des avenants de délai (avec leurs propres unités)
        # On itère sur chaque avenant pour appliquer le saut calendaire correspondant
        avenants = self.ordres_service.filter(type_os='AVENANT_DELAI')
        for av in avenants:
            if av.delai_unit == 'MOIS':
                date_fin += relativedelta(months=av.delai_supplementaire)
            elif av.delai_unit == 'SEMAINE':
                date_fin += relativedelta(weeks=av.delai_supplementaire)
            else:
                date_fin += relativedelta(days=av.delai_supplementaire)
            date_fin += relativedelta(days=av.delai_jours_supplementaire or 0)
        # 3. Prise en compte des suspensions (Arrêts et Reprises)
        jours_arret_total = 0
        reprises = self.ordres_service.filter(type_os='REPRISE').select_related('os_arret_concerne')
        
        for reprise in reprises:
            if reprise.os_arret_concerne:
                # On calcule la durée exacte de chaque période d'arrêt
                jours_arret_total += (reprise.date_os - reprise.os_arret_concerne.date_os).days

        # 4. Gestion d'un arrêt toujours en cours
        dernier_os = self.ordres_service.order_by('-date_os').first()
        if dernier_os and dernier_os.type_os == 'ARRET':
            # Si le chantier est actuellement arrêté, la date de fin recule chaque jour
            jours_arret_total += (date.today() - dernier_os.date_os).days

        # 5. Application du décalage total dû aux suspensions
        return date_fin + timezone.timedelta(days=jours_arret_total)
    # ============================
    # 🔹 AJOUT 2 : Districts touchés
    # ============================
    @property
    def districts_touches(self):

        if not self.axe:
            return []

        districts = set()

        segments_districts = list(self.axe.segments_districts.all())
        segments_marche = list(self.segments_pk.all())

        for seg_m in segments_marche:
            for seg_d in segments_districts:

                if (
                    seg_d.pk_debut < seg_m.pk_fin and
                    seg_d.pk_fin > seg_m.pk_debut
                ):
                    if seg_d.district:
                        districts.add(seg_d.district)

        return list(districts)
    
    @property
    def regions_touchees(self):
        return set(d.region for d in self.districts_touches)

    # ============================
    # 🔹 AJOUT 4 (OPTIONNEL) : Longueur totale du marché
    # ============================
    @property
    def longueur_totale(self):
        total = 0
        for seg in self.segments_pk.all():
            total += float(seg.pk_fin - seg.pk_debut)
        return round(total, 3)

    def __str__(self):
        return f"{self.num_marche} - {self.axe.designation}"


class PKMarche(models.Model):
    marche = models.ForeignKey(
        'Marche',
        on_delete=models.CASCADE,
        related_name='segments_pk',
        verbose_name="Marché"
    )
    pk_debut = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        verbose_name="PK Début"
    )
    pk_fin = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        verbose_name="PK Fin"
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Description du tronçon"
    )

    def clean(self):
        # 1. Vérification de présence
        if self.pk_debut is None or self.pk_fin is None:
            return

        # 2. Cohérence mathématique
        if self.pk_debut > self.pk_fin:
            raise ValidationError({
                'pk_fin': "Le PK de fin ne peut pas être inférieur au PK de début."
            })

        # 3. Validation des conflits
        # Correction : On vérifie si self.marche a un ID (est déjà en base)
        # et si self.marche_id n'est pas None (pour les formulaires)
        if self.marche and self.marche.pk:
            conflits = PKMarche.objects.filter(
                marche=self.marche,
                pk_debut__lt=self.pk_fin,
                pk_fin__gt=self.pk_debut
            ).exclude(id=self.id)

            if conflits.exists():
                c = conflits.first()
                raise ValidationError(
                    f"Conflit avec un segment existant : [{c.pk_debut} - {c.pk_fin}]"
                )
    def save(self, *args, **kwargs):
        # Important : appeler clean() manuellement pour que la validation 
        # s'applique aussi hors formulaires (ex: script, shell)
        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "PK du Marché"
        verbose_name_plural = "PK des Marchés"
        ordering = ['marche', 'pk_debut']
        
        # Note : La contrainte UniqueConstraint sur pk_debut empêchera 
        # d'avoir deux segments commençant au même point exact. 
        # Si c'est ce que vous voulez, gardez-la. Sinon, supprimez-la.
        constraints = [
            models.UniqueConstraint(
                fields=['marche', 'pk_debut'],
                name='unique_pk_debut_par_marche'
            )
        ]

    def __str__(self):
        return f"{self.marche} : PK {self.pk_debut} → {self.pk_fin}"



class Avancement(models.Model):

    marche = models.ForeignKey(
        'Marche',
        on_delete=models.CASCADE,
        related_name='avancements'
    )

    date_avancement = models.DateField()

    avancement_physique = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True
    )

    avancement_financier = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True
    )
    SITUATION_CHOICES = [
        ('En_cours', 'En Cours'),
        ('Arrete', 'En Arrêt'),
        ('Acheve', 'Achevé'),
        ('Résilié', 'Résilié'),
    ]
    situation_w = models.CharField(
        max_length=20, 
        choices=SITUATION_CHOICES
    )
    detail_situation = models.TextField(blank=True, null=True)
    observation = models.TextField(blank=True, null=True)

    # 🔹 CORRECTION SECURITE
    @property
    def avancement_temporel(self):
        """
        Calcule le pourcentage de temps consommé avec précision calendaire.
        """
        # 1. Détermination de la date de démarrage (Priorité OS > Legacy)
        os_debut = self.marche.ordres_service.filter(type_os='COMMENCEMENT').first()
        date_ref = os_debut.date_os if os_debut else self.marche.os_com

        if not date_ref or not self.marche.delai_nombre:
            return 0.0

        # 2. CALCUL DU DÉLAI TOTAL CONTRACTUEL (Date de fin théorique)
        # On commence par le délai initial
        if self.marche.delai_unit == 'MOIS':
            date_fin_theorique = date_ref + relativedelta(months=self.marche.delai_nombre)
        elif self.marche.delai_unit == 'SEMAINE':
            date_fin_theorique = date_ref + relativedelta(weeks=self.marche.delai_nombre)
        else:
            date_fin_theorique = date_ref + relativedelta(days=self.marche.delai_nombre)

        date_fin_theorique += relativedelta(days=self.marche.delai_jours)
        # On ajoute les avenants de délai (avec leur propre unité)
        avenants = self.marche.ordres_service.filter(
            type_os='AVENANT_DELAI', 
            date_os__lte=self.date_avancement
        )
        for av in avenants:
            if av.delai_unit == 'MOIS':
                date_fin_theorique += relativedelta(months=av.delai_supplementaire)
            elif av.delai_unit == 'SEMAINE':
                date_fin_theorique += relativedelta(weeks=av.delai_supplementaire)
            else:
                date_fin_theorique += relativedelta(days=av.delai_supplementaire)
            date_fin_theorique += relativedelta(days=av.delai_jours_supplementaire or 0)
        # Nombre total de jours réels accordés au titulaire
        delai_total_jours = (date_fin_theorique - date_ref).days

        if delai_total_jours <= 0:
            return 0.0

        # 3. CALCUL DES JOURS CONSOMMÉS (Déduction faite des arrêts)
        ordres_chronos = self.marche.ordres_service.filter(
            date_os__gt=date_ref,
            date_os__lte=self.date_avancement
        ).order_by('date_os')

        jours_consommes = 0
        curseur = date_ref
        en_arret = False

        for os in ordres_chronos:
            if os.type_os == 'ARRET' and not en_arret:
                jours_consommes += (os.date_os - curseur).days
                en_arret = True
            elif os.type_os == 'REPRISE' and en_arret:
                curseur = os.date_os
                en_arret = False

        if not en_arret:
            jours_consommes += (self.date_avancement - curseur).days

        # 4. POURCENTAGE FINAL
        pourcentage = (jours_consommes / delai_total_jours) * 100
        
        return round(min(max(pourcentage, 0), 100.0), 2)
    # 🔹 AJOUT indicateur retard
    @property
    def est_en_retard(self):
        if self.avancement_temporel > (self.avancement_physique or 0):
            return True
        return False

    class Meta:
        ordering = ['-date_avancement']

        # 🔹 AJOUT index performance
        indexes = [
            models.Index(fields=['date_avancement']),
        ]

    def __str__(self):
        return f"Avancement {self.marche.num_marche} au {self.date_avancement}"

    

class MediaAvancement(models.Model):

    avancement = models.ForeignKey(
        'Avancement',
        on_delete=models.CASCADE,
        related_name='medias'
    )

    fichier = models.FileField(
        upload_to='travaux/%Y/%m/%d/'
    )

    legende = models.CharField(max_length=255, blank=True)
    date_upload = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Média pour {self.avancement}"


class OS(models.Model):
    TYPE_OS = [
        ('COMMENCEMENT', 'OS de Commencement'),
        ('ARRET', 'OS d\'Arrêt'),
        ('REPRISE', 'OS de Reprise'),
        ('AVENANT_DELAI', 'Avenant de Délai'),
    ]

    marche = models.ForeignKey('Marche', on_delete=models.CASCADE, related_name='ordres_service')
    type_os = models.CharField(max_length=20, choices=TYPE_OS)
    date_os = models.DateField()
    
    # Pour l'avenant : nombre de jours/mois ajoutés
    delai_supplementaire = models.IntegerField(default=0, help_text="Valeur à ajouter au délai initial")
    DELAI_UNIT_CHOICES = [
        ('JOUR', 'Jour(s)'),
        ('SEMAINE', 'Semaine(s)'),
        ('MOIS', 'Mois'),
    ]
    delai_unit = models.CharField(
        max_length=10, 
        choices=DELAI_UNIT_CHOICES, 
        default='MOIS'
    )

    # 🔹 AJOUT : Le complément spécifique en jours
    delai_jours_supplementaire = models.IntegerField(
        default=0, 
        verbose_name="Jours additionnels",
        help_text="Complément en jours si l'unité principale est en Mois"
    )
    # Pour la reprise : lier à l'OS d'arrêt correspondant
    os_arret_concerne = models.OneToOneField(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='os_reprise',
        limit_choices_to={'type_os': 'ARRET'},
        help_text="Si c'est une reprise, quel arrêt prend fin ?"
    )

    commentaire = models.TextField(blank=True)

    class Meta:
        ordering = ['date_os']

    def clean(self):
        # Validation : Une reprise doit obligatoirement pointer vers un arrêt
        if self.type_os == 'REPRISE' and not self.os_arret_concerne:
            raise ValidationError("Une reprise doit préciser l'OS d'arrêt correspondant.")
        
        # Validation : La reprise ne peut pas être avant l'arrêt
        if self.os_arret_concerne and self.date_os < self.os_arret_concerne.date_os:
            raise ValidationError("La date de reprise ne peut pas être antérieure à la date d'arrêt.")

    def __str__(self):
        return f"{self.get_type_os_display()} - {self.date_os}"
    
@receiver(post_save, sender=OS)
def update_marche_situation_on_os(sender, instance, created, **kwargs):
    # On ne déclenche le changement que pour les OS impactant le statut
    STATUT_MAP = {
        'ARRET': 'Arrete',
        'REPRISE': 'En_cours',
        'COMMENCEMENT': 'En_cours'
    }
    
    if instance.type_os in STATUT_MAP:
        nouveau_statut = STATUT_MAP[instance.type_os]
        dernier_av = Avancement.objects.filter(marche=instance.marche).order_by('-date_avancement').first()

        # On utilise update_or_create pour éviter les doublons à la même date
        Avancement.objects.update_or_create(
            marche=instance.marche,
            date_avancement=instance.date_os,
            defaults={
                'situation_w': nouveau_statut,
                'avancement_physique': dernier_av.avancement_physique if dernier_av else 0,
                'avancement_financier': dernier_av.avancement_financier if dernier_av else 0,
                'observation': f"Statut mis à jour par {instance.get_type_os_display()} du {instance.date_os}"
            }
        )

class Annuaire(models.Model):
    # Choix pour les régions (exemple)
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    nom = models.CharField(max_length=255,blank=True, null=True)
    region = models.CharField(max_length=100, choices=Localisation.REGION_CHOICES)
    fonction = models.CharField(max_length=255)
    telephone = models.CharField(max_length=20)
    telephone1 = models.CharField(max_length=20,blank=True, null=True)
    whatsapp = models.CharField(max_length=20, blank=True, null=True)
    whatsapp1 = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    def save(self, *args, **kwargs):
        """
        Nettoyage automatique avant l'enregistrement en base de données.
        """
        # Nettoyage du nom en MAJUSCULES
        if self.nom:
            self.nom = self.nom.strip().upper()

        if self.fonction:
            # .strip() élimine les espaces avant et après
            # .upper() transforme tout en MAJUSCULES
            self.fonction = self.fonction.strip().upper()
        
        super(Annuaire, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.fonction} - {self.region}"


class Bac(models.Model):
    # --- Localisation ---
    axe = models.ForeignKey(
        Axe, 
        on_delete=models.CASCADE, 
        related_name='bacs',
        verbose_name="Axe Routier",
        blank=True,
        null=True
    )
    pk_bac = models.DecimalField("PK", max_digits=10, decimal_places=3, blank=True, null=True)
    region = models.CharField("Région", max_length=100, choices=Localisation.REGION_CHOICES)
    localite = models.CharField("Localité", max_length=250, blank=True, null=True)
    
    # Précision GPS accrue (6 décimales = précision à ~10cm)
    longitude = models.DecimalField("Longitude", max_digits=10, decimal_places=6, blank=True, null=True)
    latitude = models.DecimalField("Latitude", max_digits=10, decimal_places=6, blank=True, null=True)

    # --- Caractéristiques Techniques ---
    riviere = models.CharField("Rivière / Franchissement", max_length=250, blank=True, null=True)
    longueur_travers = models.PositiveIntegerField("Longueur du Traversé (ml)", default=0) 
    constructeur = models.CharField("Constructeur", max_length=250, blank=True, null=True)
    
    PROPS_CHOICES = [
        ('Moteur', 'Moteur'),
        ('Perche', 'Perche'),
        ('Treuil', 'Treuil'),
        ('Treuil_a_moteur', 'Treuil à moteur')
    ]
    propulsion = models.CharField("Propulsion", choices=PROPS_CHOICES, max_length=50, blank=True, null=True)
    portance = models.PositiveIntegerField("Portance (Tonnes)", default=0)
    nbr_capacite = models.PositiveIntegerField("Capacité (Pers/Véhicules)", default=0)
    
    # --- Gestion et Personnel ---
    gestionnaire = models.CharField("Gestionnaire Actuel", max_length=255, blank=True, null=True)
    chef_bac = models.CharField("Responsable du Bac", max_length=150, blank=True, null=True)
    
    PASSEUR_CHOICES = [
        ('DRTP', 'DRTP'),
        ('AR', 'AR'),
        ('DRTP/AR', 'DRTP/AR')
    ]
    employeur_passeur = models.CharField("Employeurs des passeurs", choices=PASSEUR_CHOICES, max_length=20, blank=True, null=True)
    nbre_passeur_fonc = models.PositiveIntegerField("Passeurs Fonctionnaires", default=0, blank=True, null=True)
    nbre_passeur_ecd = models.PositiveIntegerField("Passeurs ECD", default=0, blank=True, null=True)
    nbre_passeur_ar = models.PositiveIntegerField("Passeurs AR", default=0 , blank=True, null=True)

    # --- État et Maintenance ---
    ETAT_CHOICES = [
        ('Operationel', 'Opérationnel'),
        ('En maintenance', 'En Maintenance'),
        ('Fonctionnel_degrade', 'Fonctionnel avec dégradation'),
        ('degrade', 'Dégradé'),
        ('Hors_usage', 'Hors d\'usage')
    ]
    etat_bac = models.CharField("État du Bac", max_length=50, choices=ETAT_CHOICES, default='Operationel')
    detail_etat_bac = models.TextField("Détails sur l'état", blank=True, null=True)
    observation = models.TextField("Observations", blank=True, null=True)
    annee_entretien = models.PositiveIntegerField("Année dernier entretien", blank=True, null=True)
    annee_acquisition = models.PositiveIntegerField("Année d'acquisition", blank=True, null=True)

    # --- Finances et Projets ---
    besoin_entretien_bac = models.DecimalField("Besoin Financement (Ar)", max_digits=20, decimal_places=2, default=0, blank=True, null=True)
    CHOICE_FINANCEMENT = [
        ('ACQUIS', 'ACQUIS'),
        ('A RECHERCHER', 'A RECHERCHER')
    ]
    etat_financement_bac = models.CharField("Statut Financement", choices=CHOICE_FINANCEMENT, max_length=20, blank=True, null=True)
    annee_exercice = models.PositiveIntegerField("Année d'exercice", blank=True, null=True)
    
    projet_en_cours = models.TextField("Projet en cours", blank=True, null=True)
    projet_en_perspective = models.TextField("Projet en vue", blank=True, null=True)
    
    image = models.ImageField(upload_to='bacs/photos/', blank=True, null=True)
    date_create = models.DateTimeField(auto_now_add=True)
    date_update = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Bac de traversée"
        verbose_name_plural = "Bacs de traversée"
        ordering = ['region', 'axe', 'pk_bac'] # Tri plus logique pour un inventaire

    def __str__(self):
        axe_nom = self.axe.designation if self.axe else "Axe non défini"
        return f"Bac {self.localite or 'Sans nom'} ({axe_nom} - PK {self.pk_bac})"
class ConventionProgramme(models.Model):
    SURFACE_CHOICES = [
        ('RB', 'Revêtement Bitumineux'),
        ('RT', 'Revêtement Terre'),
    ]

    # --- Relation vers votre modèle Axe ---
    axe = models.ForeignKey(
        Axe, 
        on_delete=models.CASCADE, 
        related_name='conventions',
        verbose_name="Axe Routier"
    )
    
    # --- Identification ---
    section = models.CharField("Section / Tronçon", max_length=255)
    region = models.CharField("Région de l'intervention",choices=Localisation.REGION_CHOICES, max_length=100)
    annee = models.PositiveIntegerField("Année budgétaire", default=2026)

    # --- PK et Localités ---
    pk_debut = models.DecimalField("PK Début", max_digits=10, decimal_places=3)
    localite_deb = models.CharField("Localité de début", max_length=255)
    pk_fin = models.DecimalField("PK Fin", max_digits=10, decimal_places=3)
    localite_fin = models.CharField("Localité de fin", max_length=255)

    # --- Longueurs (Calculée automatiquement) ---
    longueur = models.DecimalField(
        "Longueur Totale (km)", 
        max_digits=10, 
        decimal_places=3, 
        editable=False # On empêche la saisie manuelle
    )
    longueur_traite = models.DecimalField("Longueur effectivement traitée (km)", max_digits=10, decimal_places=3)
    nature_surface = models.CharField(max_length=2, choices=SURFACE_CHOICES, default='RT')

    # --- Données Financières ---
    montant_minima = models.DecimalField("Montant Minima (Ar)", max_digits=20, decimal_places=2, default=0)
    montant_souhaite = models.DecimalField("Montant Souhaité (Ar)", max_digits=20, decimal_places=2, default=0)

    # --- Timestamps ---
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Calcul automatique de la longueur du tronçon
        self.longueur = abs(self.pk_fin - self.pk_debut)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Convention Programme"
        verbose_name_plural = "Conventions Programmes"
        ordering = ['-annee', 'axe__designation', 'pk_debut']

    def __str__(self):
        return f"{self.axe.designation} - {self.section} ({self.annee})"


class TravauxGlisse(models.Model): # Majuscules et singulier
    # Liaison à l'Axe
    axe = models.ForeignKey(
        'Axe', 
        on_delete=models.CASCADE, 
        related_name='travaux_glisses', # Nom unique
        verbose_name="Axe Routier"
    )
    
    # Liaison au Marché (le contrat qui "glisse")
    marche = models.ForeignKey(
        'Marche',
        on_delete=models.CASCADE,
        related_name='glissements'
    )

    # --- Autorisation Unique de Crédit (AUC) ---
    CHOICE_AUC = [
        ('En attente', 'En Attente'),
        ('Obtenue', 'Obtenue'),
    ]
    auc = models.CharField(max_length=20, choices=CHOICE_AUC, blank=True, null=True)
    date_auc = models.DateField(blank=True, null=True)

    # --- État de la Passation ---
    CHOICE_PASSATION = [
        ('en_cours', 'Passation en cours'),
        ('OS_delivre', 'OS Délivré'),
        ('Lancement_AO_cours', 'Lancement AO En cours'),
    ]
    passation = models.CharField(max_length=20, choices=CHOICE_PASSATION, blank=True, null=True)

    observation = models.TextField(blank=True, null=True)
    
    # Indispensable pour le suivi budgétaire
    annee_origine = models.PositiveIntegerField("Année d'origine", default=2025)
    annee_report = models.PositiveIntegerField("Reporté en", default=2026)
    montant_reliquat = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    def __str__(self):
        return f"Glissement {self.marche.num_marche} ({self.annee_origine} -> {self.annee_report})"
    
    def clean(self):
        from django.core.exceptions import ValidationError
        # Logique : l'année de report doit être après l'année d'origine
        if self.annee_report <= self.annee_origine:
            raise ValidationError("L'année de report doit être supérieure à l'année d'origine.")
    
