# -*- coding: utf-8 -*-
from django.contrib import admin
from django.utils.html import format_html
from django.db import models
from .models import Bac, Axe, PKDistrict, Marche, PKMarche, Avancement, MediaAvancement, Localisation, OS, Annuaire, ConventionProgramme, MessageMarche

from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget, DateWidget, DecimalWidget, IntegerWidget

# Optionnel : Définir l'encodage par défaut pour l'import
from import_export.formats import base_formats
from django.conf import settings

from import_export.admin import ImportExportModelAdmin

from django.contrib.auth.models import User


# Vérification pour le groupe OperateurTravaux
def is_operateur_travaux(user):
    return user.groups.filter(name='OperateurTravaux').exists()

# Chef d'axe
def is_chef_axe(user):
    return user.groups.filter(name='chef_axe').exists()

class LocalisationResource(resources.ModelResource):
    class Meta:
        model = Localisation
        # Vous pouvez choisir l'ordre des colonnes pour l'export
        fields = ('id', 'province', 'region', 'district')
        export_order = ('id', 'province', 'region', 'district')

@admin.register(Localisation)
class LocalisationAdmin(ImportExportModelAdmin): # Une seule classe qui hérite de ImportExport
    resource_class = LocalisationResource
    
    # On regroupe toutes les options ici
    list_display = ('district', 'region', 'province')
    list_filter = ('province', 'region')
    search_fields = ('district', 'region', 'province')
    
    # Cette ligne est cruciale pour que l'autocomplétion fonctionne 
    # dans AxeAdmin et PKDistrictInline
    ordering = ('province', 'region', 'district')


class PKDistrictInline(admin.TabularInline):
    model = PKDistrict
    extra = 1
    # On met la longueur en readonly_fields pour l'affichage uniquement
    readonly_fields = ('longueur',)
    autocomplete_fields = ['district'] 
    # Organisation des champs dans l'inline
    fields = ('district', 'section', 'pk_debut', 'deb', 'pk_fin', 'fin', 'surface', 'longueur')


class PKDistrictResource(resources.ModelResource):
    axe = fields.Field(
        column_name='axe',
        attribute='axe',
        widget=ForeignKeyWidget(Axe, 'designation')
    )
    district = fields.Field(
        column_name='district',
        attribute='district',
        widget=ForeignKeyWidget(Localisation, 'district')
    )

    class Meta:
        model = PKDistrict
        import_id_fields = ('axe','pk_debut','pk_fin')
        # On liste les champs sauf 'longueur' car il est auto-généré
        fields = ('id', 'axe', 'district', 'pk_debut', 'deb', 'pk_fin', 'fin', 'section', 'surface')
        export_order = fields

    def before_import_row(self, row, **kwargs):
        # Nettoyage classique des PK (virgule vers point)
        for field in ['pk_debut', 'pk_fin']:
            val = row.get(field)
            if val:
                row[field] = str(val).replace(',', '.').replace(' ', '').strip()

@admin.register(PKDistrict)
class PKDistrictAdmin(ImportExportModelAdmin):
    resource_class = PKDistrictResource
    list_display = ('axe', 'district', 'section', 'pk_debut', 'pk_fin', 'display_longueur', 'surface')
    readonly_fields = ('longueur',) # Important car editable=False dans le modèle
    autocomplete_fields = ['axe', 'district']

    def display_longueur(self, obj):
        return f"{obj.longueur} km"
    display_longueur.short_description = "Long. (Calculée)"

class PKMarcheInline(admin.TabularInline):
    model = PKMarche
    extra = 1

class MediaAvancementInline(admin.TabularInline):
    model = MediaAvancement
    extra = 1
    readonly_fields = ('aperçu',)

    def aperçu(self, obj):
        if obj.fichier:
            return format_html('<img src="{}" style="width: 100px; height: auto;" />', obj.fichier.url)
        return "Pas d'aperçu"


class AxeResource(resources.ModelResource):
    # Changement : on utilise 'id' au lieu de 'district' pour mapper les IDs numériques
    pk_debut_district = fields.Field(
        column_name='pk_debut_district',
        attribute='pk_debut_district',
        widget=ForeignKeyWidget(Localisation, 'id') # Lie l'ID 19, 58, 64, etc.
    )
    pk_fin_district = fields.Field(
        column_name='pk_fin_district',
        attribute='pk_fin_district',
        widget=ForeignKeyWidget(Localisation, 'id')
    )
    
    attache_suivi = fields.Field(
        column_name='attache_suivi',
        attribute='attache_suivi',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = Axe
        # IMPORTANT : On définit l'id comme champ pivot pour les mises à jour
        import_id_fields = ('id',) 
        fields = (
            'id', 'designation', 'type_axe', 'longueur_total', 
            'pk_debut_district', 'pk_fin_district', 'description', 'attache_suivi'
        )
        export_order = fields

    def before_import_row(self, row, **kwargs):
        """
        Nettoyage automatique : si Excel contient "19 (TANA I)", 
        on ne garde que "19" pour que le ForeignKeyWidget fonctionne.
        """
        for field in ['pk_debut_district', 'pk_fin_district']:
            value = str(row.get(field, ''))
            if '(' in value:
                # On extrait uniquement les chiffres avant la parenthèse
                row[field] = value.split('(')[0].strip()

# --- ADMIN CLASSES ---
@admin.register(Axe)
class AxeAdmin(ImportExportModelAdmin): # Changement ici
    resource_class = AxeResource # Ajout ici
    list_display = ('designation', 'type_axe', 'longueur_total', 'pk_debut_district', 'pk_fin_district', 'attache_suivi')
    autocomplete_fields = ['pk_debut_district', 'pk_fin_district']
    list_filter = ('type_axe', 'attache_suivi', 'pk_debut_district__province')
    search_fields = ('designation', 'description', 'pk_debut_district__district', 'pk_fin_district__district')
    readonly_fields = ('updated_at',) # On complétera dynamiquement cette liste
    inlines = [PKDistrictInline]
    
    fieldsets = (
        ('Informations Générales', {
            'fields': ('designation', 'type_axe', 'description')
        }),
        ('Détails Géographiques', {
            'description': "Sélectionnez le district en saisissant son nom",
            'fields': ('pk_debut_district', 'pk_fin_district', 'longueur_total')
        }),
        ('Responsabilité', {
            'fields': ('attache_suivi', 'updated_at')
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        """Rend le champ attache_suivi modifiable uniquement par les admins"""
        if request.user.is_superuser:
            return self.readonly_fields
        return list(self.readonly_fields) + ['attache_suivi']

    def save_model(self, request, obj, form, change):
        """Assigne automatiquement l'utilisateur connecté à la création"""
        if not obj.pk: # Si c'est une création (pas d'ID encore)
            if not request.user.is_superuser or not obj.attache_suivi:
                obj.attache_suivi = request.user
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        # On force d'abord la sauvegarde de l'objet parent (l'Axe)
        # pour garantir qu'il possède un ID.
        parent = form.save(commit=False)
        if not parent.pk:
            parent.save()
            
        instances = formset.save(commit=False)
        for instance in instances:
            instance.axe = parent # On lie l'ID qui vient d'être créé
            instance.save()
        formset.save_m2m()
    
    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related(
            'pk_debut_district',
            'pk_fin_district'
        )

        if request.user.is_superuser or is_operateur_travaux(request.user):
            return qs

        if is_chef_axe(request.user):
            return qs.filter(attache_suivi=request.user)

        return qs.none()  # sécurité maximale



class MarcheResource(resources.ModelResource):
    # Liaison avec l'Axe par son nom (ex: RNP 2)
    axe = fields.Field(
        column_name='axe',
        attribute='axe',
        widget=ForeignKeyWidget(Axe, 'designation')
    )

    # Date formatée pour Excel (JJ/MM/AAAA)
    os_com = fields.Field(
        column_name='os_com',
        attribute='os_com',
        widget=DateWidget(format='%d/%m/%Y')
    )

    class Meta:
        model = Marche
        # L'id UUID est généré par Django si la colonne est vide dans le fichier
        import_id_fields = ('id',)
        fields = (
            'id', 'num_marche', 'axe', 
            'description', 'resume', 'financement', 'detail_financement', 
            'tiers', 'montant', 'titulaire', 'os_com', 'delai_unit', 'delai_nombre'
        )
        export_order = fields

    def before_import_row(self, row, **kwargs):
        """
        Optionnel : Cette fonction permet de convertir les labels en clés techniques
        si votre fichier Excel contient les noms complets (ex: "Gros Œuvre" -> "GROS")
        """
        # Mapping pour Categorie Oeuvre
        cat_map = {'Gros Œuvre': 'GROS', 'Petit Œuvre': 'PETIT'}
        if row.get('categorie_oeuvre') in cat_map:
            row['categorie_oeuvre'] = cat_map[row['categorie_oeuvre']]
            
        # Mapping pour Financement
        fin_map = {'Financement Extérieur': 'FIN_EX', 'FER': 'FER', 'RPI': 'RPI'}
        if row.get('financement') in fin_map:
            row['financement'] = fin_map[row['financement']]


class OSInline(admin.TabularInline):
    model = OS
    extra = 1
    fields = ('type_os', 'date_os', 'delai_supplementaire', 'delai_unit', 'commentaire')
    # Les OS sont souvent critiques, on peut vouloir trier par date décroissante
    ordering = ('-date_os',)

class MessageMarcheInline(admin.TabularInline):
    """Fil de discussion du marché, en lecture seule depuis l'admin (les
    messages sont écrits par les utilisateurs via l'API)."""
    model = MessageMarche
    extra = 0
    fields = ('auteur', 'contenu', 'created_at')
    readonly_fields = ('auteur', 'created_at')
    ordering = ('created_at',)

@admin.register(Marche)
class MarcheAdmin(ImportExportModelAdmin):
    # 1. Configuration de l'affichage en liste (Dashboard enrichi)
    resource_class = MarcheResource # Ajout ici
    inlines=[PKMarcheInline, OSInline, MessageMarcheInline]
    list_display = (
        'marche_identifiant', 
        'axe', 
        'resume_court',              # Résumé (tronqué si trop long)
        'get_itineraire_districts',  # Itinéraire ordonné par PK
        'financement_display',       # Type de financement (Badge)
        'avancement_physique_recap', # % physique avec couleur
        'situation_actuelle',        # Statut du chantier
    )
    autocomplete_fields = ['axe',]
    # 2. Filtres et Recherche
    list_filter = (
        'financement',  
        'axe',
    )
    search_fields = ('num_marche', 'titulaire', 'axe__designation', 'resume', 'description')
    ordering = ('-os_com',)

    def save_model(self, request, obj, form, change):
        try:
            super().save_model(request, obj, form, change)
        except Exception as e:
            # Ceci affichera l'erreur précise dans votre terminal
            print(f"❌ ERREUR INSERTION MARCHE : {e}")
            # On relance l'erreur pour que Django sache que ça a échoué
            raise e
        
    # 3. Optimisation des requêtes SQL
    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('axe')

        qs = qs.prefetch_related(
            models.Prefetch(
                'axe__segments_districts',
                queryset=PKDistrict.objects.order_by('pk_debut').select_related('district')
            ),
            'avancements'
        )

        if request.user.is_superuser or is_operateur_travaux(request.user):
            return qs

        if is_chef_axe(request.user):
            return qs.filter(axe__attache_suivi=request.user)

        return qs.none()


    # --- MÉTHODES D'AFFICHAGE PERSONNALISÉES ---

    def resume_court(self, obj):
        """Affiche le début du résumé pour ne pas encombrer le tableau"""
        if obj.resume and len(obj.resume) > 50:
            return f"{obj.resume[:50]}..."
        return obj.resume
    resume_court.short_description = "Résumé du Marché"

    def financement_display(self, obj):
        """Affiche le financement avec un style distinctif"""
        colors = {
            'RPI': '#34495e',
            'FIN_EX': '#8e44ad',
            'FER': '#2980b9',
            'AUTRE': '#7f8c8d'
        }
        color = colors.get(obj.financement, '#7f8c8d')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.85em;">{}</span>',
            color,
            obj.get_financement_display()
        )
    financement_display.short_description = "Financement"

    def get_itineraire_districts(self, obj):
        """Affiche les districts traversés par l'axe, ordonnés par PK"""
        segments = obj.axe.segments_districts.all()
        noms_districts = [s.district.district for s in segments if s.district]
        
        if noms_districts:
            # District A -> District B
            return format_html(" <span style='color: #999;'>&rarr;</span> ".join(noms_districts))
        return format_html("<i style='color: #ccc;'>Non défini</i>")
    get_itineraire_districts.short_description = "Itinéraire"

    def avancement_physique_recap(self, obj):
        """Dernier % physique avec couleur d'alerte"""
        dernier = obj.avancements.first()
        if dernier and dernier.avancement_physique is not None:
            val = dernier.avancement_physique
            if val >= 80: color = "#27ae60"    # Vert
            elif val >= 40: color = "#f39c12"  # Orange
            else: color = "#e74c3c"            # Rouge
            return format_html('<b style="color: {};">{}%</b>', color, val)
        return "0%"
    avancement_physique_recap.short_description = "% Phys."

    def situation_actuelle(self, obj):
        """Affiche le dernier statut"""
        dernier = obj.avancements.first()
        return dernier.get_situation_w_display() if dernier else "Non démarré"
    situation_actuelle.short_description = "Statut"

    # --- SÉCURITÉ ---
    
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "axe":
            # Si admin ou opérateur, on montre tous les axes
            if request.user.is_superuser or is_operateur_travaux(request.user):
                kwargs["queryset"] = Axe.objects.all()
            elif is_chef_axe(request.user):
                kwargs["queryset"] = Axe.objects.filter(attache_suivi=request.user)
            else:
                kwargs["queryset"] = Axe.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def marche_identifiant(self, obj):
        """Affiche le numéro et la désignation sur la même ligne"""
        # On met le numéro en gras pour bien le distinguer
        return format_html(
            '<b>{}</b> - <span style="color: #666;">{}</span>',
            obj.num_marche,
            obj.description # Ou obj.designation selon le nom de votre champ
        )
    marche_identifiant.short_description = "Référence & Marché"

class AvancementResource(resources.ModelResource):
    # 1. Champs pivots pour l'import/update
    # On garde 'id' (de l'avancement) et 'marche' (ID du marché)
    marche = fields.Field(
        column_name='marche_id', # Colonne cruciale pour l'import
        attribute='marche',
        widget=ForeignKeyWidget(Marche, 'id')
    )

    # 2. Renseignements Marché (Lecture seule pour l'Excel)
    num_marche = fields.Field(attribute='marche__num_marche', column_name='N° Marché')
    axe_designation = fields.Field(attribute='marche__axe__designation', column_name='Axe')
    marche_resume = fields.Field(attribute='marche__resume', column_name='Détails Marché')
    marche_titulaire = fields.Field(attribute='marche__titulaire', column_name='Titulaire/Entreprise')
    marche_montant = fields.Field(attribute='marche__montant', column_name='Montant Marché')
    marche_financement = fields.Field(attribute='marche__financement', column_name='Source Financement')
    
    # 3. Champs de l'avancement
    date_avancement = fields.Field(
        column_name='date_avancement',
        attribute='date_avancement',
        widget=DateWidget(format='%d/%m/%Y')
    )
    avancement_physique = fields.Field(column_name='avancement_physique', attribute='avancement_physique', widget=DecimalWidget())
    avancement_financier = fields.Field(column_name='avancement_financier', attribute='avancement_financier', widget=DecimalWidget())

    class Meta:
        model = Avancement
        # On utilise l'ID de l'avancement comme pivot principal
        import_id_fields = ('id',)
        
        # Ordre logique pour l'utilisateur dans Excel
        fields = (
            'id', 'marche', 'num_marche', 'axe_designation', 'marche_resume', 
            'marche_titulaire', 'marche_montant', 'marche_financement',
            'date_avancement', 'avancement_physique', 'avancement_financier', 
            'situation_w', 'observation'
        )
        export_order = fields

    def before_import_row(self, row, **kwargs):
        """Nettoyage des données pour éviter les erreurs de format"""
        # Conversion virgule en point pour les pourcentages
        for field in ['avancement_physique', 'avancement_financier']:
            val = row.get(field)
            if val:
                row[field] = str(val).replace('%', '').replace(',', '.').strip()
    def get_export_formats(self):
        """ Force l'encodage UTF-8 pour les formats texte comme le CSV """
        formats = super().get_export_formats()
        # On peut filtrer ou modifier les formats ici si nécessaire
        return formats

@admin.register(OS)
class OSAdmin(admin.ModelAdmin):
    list_display = ('marche', 'type_os', 'date_os', 'delai_supplementaire', 'delai_unit')
    list_filter = ('type_os', 'date_os', 'marche__axe')
    search_fields = ('marche__num_marche', 'commentaire')
    autocomplete_fields = ['marche']

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('marche', 'marche__axe')
        if request.user.is_superuser or is_operateur_travaux(request.user):
            return qs
        if is_chef_axe(request.user):
            return qs.filter(marche__axe__attache_suivi=request.user)
        return qs.none()
    
@admin.register(Avancement)
class AvancementAdmin(ImportExportModelAdmin):
    # 1. Configuration de l'affichage en liste (Dashboard enrichi)
    resource_class = AvancementResource # Ajout ici
    # Ajout de 'avancement_anterieur' dans la liste
    list_display = (
        'marche', 
        'date_avancement', 
        'situation_w', 
        'avancement_anterieur', # Nouvelle colonne
        'avancement_physique_display', 
        'avancement_financier_display', 
        'get_temporel'
    )
    
    list_filter = ('situation_w', 'date_avancement', 'marche__axe')
    search_fields = ('marche__num_marche', 'marche__titulaire', 'observation')
    readonly_fields = ('get_temporel',)
    autocomplete_fields = ['marche'] 
    inlines = [MediaAvancementInline]

    fieldsets = (
        ('Référence', {'fields': ('marche', 'date_avancement')}),
        ('État des Lieux', {'fields': ('situation_w', 'detail_situation')}),
        ('Indicateurs (%)', {'fields': (('avancement_physique', 'avancement_financier'), 'get_temporel')}),
        ('Commentaires', {'fields': ('observation',)}),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related(
            'marche',
            'marche__axe'
        )

        if request.user.is_superuser or is_operateur_travaux(request.user):
            base_qs = qs
        elif is_chef_axe(request.user):
            base_qs = qs.filter(marche__axe__attache_suivi=request.user)
        else:
            return qs.none()

        latest_ids = (
            base_qs.order_by('marche', '-date_avancement', '-id')
            .distinct('marche')
            .values_list('id', flat=True)
        )

        return base_qs.filter(id__in=latest_ids)


    # --- MÉTHODES D'AFFICHAGE ---

    def avancement_anterieur(self, obj):
        """
        Récupère l'avancement physique qui précède immédiatement l'actuel 
        pour ce marché spécifique.
        """
        anterieur = Avancement.objects.filter(
            marche=obj.marche,
            date_avancement__lt=obj.date_avancement
        ).order_by('-date_avancement').first()
        
        if anterieur and anterieur.avancement_physique is not None:
            return f"{anterieur.avancement_physique}%"
        return format_html('<span style="color: #999;">-</span>')
    
    avancement_anterieur.short_description = "Phys. Antérieur"

    def get_temporel(self, obj):
        return f"{obj.avancement_temporel}%"
    get_temporel.short_description = "Consommation Délais"

    def avancement_physique_display(self, obj):
        return f"{obj.avancement_physique}%" if obj.avancement_physique is not None else "-"
    avancement_physique_display.short_description = "Physique Actuel"

    def avancement_financier_display(self, obj):
        return f"{obj.avancement_financier}%" if obj.avancement_financier is not None else "-"
    avancement_financier_display.short_description = "Financier"

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "marche":
            if request.user.is_superuser or is_operateur_travaux(request.user):
                kwargs["queryset"] = Marche.objects.all()
            else:
                kwargs["queryset"] = Marche.objects.filter(axe__attache_suivi=request.user)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
    


class AnnuaireResource(resources.ModelResource):
    class Meta:
        model = Annuaire
        # L'ID UUID est utilisé comme pivot pour les mises à jour
        #import_id_fields = ('id',)
        import_id_fields = ('nom', 'telephone')
        fields = ('id', 'region','nom', 'fonction', 'telephone','telephone1', 'whatsapp','whatsapp1', 'email')
        export_order = fields

    def before_import_row(self, row, **kwargs):
        # On force la majuscule aussi à l'import pour le nom
        for field in ['fonction', 'nom']:
            val = row.get(field)
            if val:
                row[field] = str(val).strip().upper()


@admin.register(Annuaire)
class AnnuaireAdmin(ImportExportModelAdmin):
    resource_class = AnnuaireResource
    
    # Affichage dans la liste
    list_display = ('fonction', 'region','nom', 'telephone','telephone1','whatsapp_link', 'email')
    list_filter = ('region',)
    search_fields = ('nom','fonction', 'telephone', 'email')
    ordering = ('fonction','nom')

    # Rendu visuel pour WhatsApp et Email
    def whatsapp_link(self, obj):
        if obj.whatsapp:
            return format_html(
                '<a href="https://wa.me/{}" target="_blank" style="color: #25D366; font-weight: bold;">WhatsApp</a>',
                obj.whatsapp.replace(' ', '').replace('+', '')
            )
        return "-"
    whatsapp_link.short_description = "Lien WA"

    def save_model(self, request, obj, form, change):
        """Sécurité supplémentaire : force le formatage même via l'interface admin"""
        if obj.fonction:
            obj.fonction = obj.fonction.strip().upper()
        super().save_model(request, obj, form, change)


class ConventionProgrammeResource(resources.ModelResource):

    # 🔹 Liaison avec Axe via designation
    axe = fields.Field(
        column_name='axe',
        attribute='axe',
        widget=ForeignKeyWidget(Axe, 'designation')
    )

    # 🔹 Gestion des PK (float)
    pk_debut = fields.Field(
        column_name='pk_debut',
        attribute='pk_debut',
        widget=DecimalWidget()
    )

    pk_fin = fields.Field(
        column_name='pk_fin',
        attribute='pk_fin',
        widget=DecimalWidget()
    )

    class Meta:
        model = ConventionProgramme

        # 🔑 Champ pivot pour update
        import_id_fields = ('axe', 'annee', 'section','pk_debut','pk_fin','region')

        fields = (
            'id',
            'axe',
            'annee',
            'region',
            'section',
            'pk_debut',
            'localite_deb',
            'pk_fin',
            'localite_fin',
            'longueur_traite',
            'nature_surface',
            'montant_minima',
            'montant_souhaite'
        )

        export_order = fields

    def before_import_row(self, row, **kwargs):
        """
        Nettoyage des données Excel avant import
        """

        # 🔹 Nettoyage des PK (virgule → point)
        for field in ['pk_debut', 'pk_fin']:
            val = row.get(field)
            if val:
                row[field] = str(val).replace(',', '.').strip()

        # 🔹 Nettoyage texte
        for field in ['section', 'localite_deb', 'localite_fin']:
            if row.get(field):
                row[field] = str(row[field]).strip()

        # 🔹 Gestion région (si choix)
        if row.get('region'):
            row['region'] = str(row['region']).strip().upper()

@admin.register(ConventionProgramme)
class ConventionProgrammeAdmin(ImportExportModelAdmin):

    resource_class = ConventionProgrammeResource

    list_display = (
        'axe',
        'annee',
        'region',
        'section',
        'pk_range',
        'longueur_traite',
        'montant_souhaite'
    )

    list_filter = ('annee', 'region', 'axe')
    search_fields = ('section', 'axe__designation', 'localite_deb', 'localite_fin')
    autocomplete_fields = ['axe']

    ordering = ('-annee',)

    # 🔹 Affichage personnalisé PK
    def pk_range(self, obj):
        if obj.pk_debut is not None and obj.pk_fin is not None:
            return f"{obj.pk_debut} → {obj.pk_fin}"
        return "-"
    pk_range.short_description = "PK Début - Fin"

    # 🔹 Sécurité (comme Marche)
    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "axe":
            if request.user.is_superuser or is_operateur_travaux(request.user):
                kwargs["queryset"] = Axe.objects.all()
            elif is_chef_axe(request.user):
                kwargs["queryset"] = Axe.objects.filter(attache_suivi=request.user)
            else:
                kwargs["queryset"] = Axe.objects.none()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('axe')

        if request.user.is_superuser or is_operateur_travaux(request.user):
            return qs

        if is_chef_axe(request.user):
            return qs.filter(axe__attache_suivi=request.user)

        return qs.none()
    

class BacResource(resources.ModelResource):
    # Liaison avec l'Axe par sa désignation (ex: RN 2)
    axe = fields.Field(
        column_name='axe',
        attribute='axe',
        widget=ForeignKeyWidget(Axe, 'designation')
    )

    # Champs numériques avec widget Decimal pour gérer les formats Excel
    pk_bac = fields.Field(column_name='pk_bac', attribute='pk_bac', widget=DecimalWidget())
    portance = fields.Field(column_name='portance', attribute='portance', widget=DecimalWidget())
    longitude = fields.Field(column_name='longitude', attribute='longitude', widget=DecimalWidget())
    latitude = fields.Field(column_name='latitude', attribute='latitude', widget=DecimalWidget())
    besoin_entretien_bac = fields.Field(column_name='besoin_entretien_bac', attribute='besoin_entretien_bac', widget=DecimalWidget())
    
    # Champs entiers pour le personnel
    nbre_passeur_fonc = fields.Field(column_name='nbre_passeur_fonc', attribute='nbre_passeur_fonc', widget=IntegerWidget())
    nbre_passeur_ecd = fields.Field(column_name='nbre_passeur_ecd', attribute='nbre_passeur_ecd', widget=IntegerWidget())
    nbre_passeur_ar = fields.Field(column_name='nbre_passeur_ar', attribute='nbre_passeur_ar', widget=IntegerWidget())

    class Meta:
        model = Bac
        import_id_fields = ('axe','pk_bac','riviere') # Pivot de mise à jour
        # Liste exhaustive de toutes les colonnes du modèle
        fields = (
            'id', 'axe', 'region', 'localite', 'pk_bac', 'riviere', 
            'longitude', 'latitude', 'gestionnaire', 'employeur_passeur','chef_bac', 
            'propulsion', 'portance', 'nbr_capacite', 'longueur_travers', 
            'constructeur', 'etat_bac', 'detail_etat_bac', 
            'nbre_passeur_fonc', 'nbre_passeur_ecd', 'nbre_passeur_ar', 
            'besoin_entretien_bac', 'etat_financement_bac', 'annee_exercice','projet_en_cours','projet_en_perspective','annee_entretien'
        )
        export_order = fields

    def before_import_row(self, row, **kwargs):
        """ Nettoyage automatique des données avant insertion """
        # Nettoyage des espaces et conversion virgule -> point pour tous les nombres
        num_fields = ['pk_bac', 'portance', 'longitude', 'latitude', 'besoin_entretien_bac']
        for field in num_fields:
            val = row.get(field)
            if val:
                row[field] = str(val).replace(',', '.').replace(' ', '').strip()

        # Conversion automatique des textes en MAJUSCULES pour la cohérence (comme dans votre Annuaire)
        for field in ['localite', 'riviere', 'gestionnaire', 'chef_bac']:
            if row.get(field):
                row[field] = str(row[field]).strip().upper()

@admin.register(Bac)
class BacAdmin(ImportExportModelAdmin):
    resource_class = BacResource
    
    # Colonnes visibles dans la liste principale
    list_display = (
        'localite', 'axe', 'pk_bac', 'region', 
        'etat_bac_status', 'nbr_capacite', 'annee_exercice'
    )
    
    # Filtres latéraux
    list_filter = ('region', 'etat_bac', 'annee_exercice', 'axe__type_axe')
    
    # Recherche textuelle
    search_fields = ('localite', 'riviere', 'chef_bac', 'axe__designation')
    
    # Autocomplétion pour l'Axe (évite de charger 500 axes dans un menu déroulant)
    autocomplete_fields = ['axe']

    # Organisation du formulaire d'édition (Toutes les colonnes sont ici)
    fieldsets = (
        ('📍 Localisation & GPS', {
            'fields': (
                ('axe', 'region'),
                'localite', 
                ('pk_bac', 'riviere'),
                ('longitude', 'latitude')
            )
        }),
        ('⚙️ Caractéristiques Techniques', {
            'fields': (
                ('propulsion', 'portance', 'nbr_capacite'),
                'longueur_travers', 
                'constructeur'
            )
        }),
        ('📊 État & Maintenance', {
            'fields': (
                'etat_bac', 
                'detail_etat_bac', 
                'image'
            )
        }),
        ('👥 Ressources Humaines', {
            'description': "Répartition des passeurs par statut",
            'fields': (
                'gestionnaire', 
                'chef_bac',
                ('nbre_passeur_fonc', 'nbre_passeur_ecd', 'nbre_passeur_ar')
            )
        }),
        ('💰 Budget & Exercice', {
            'fields': (
                'besoin_entretien_bac', 
                'etat_financement_bac', 
                'annee_exercice'
            )
        }),
    )

    # Affichage coloré de l'état dans la liste
    def etat_bac_status(self, obj):
        color_map = {
            'Operationel': 'green',
            'En maintenance': 'orange',
            'Hors_usage': 'red',
            'Noye': 'black'
        }
        return format_html(
            '<b style="color: {};">{}</b>',
            color_map.get(obj.etat_bac, 'gray'),
            obj.get_etat_bac_display()
        )
    etat_bac_status.short_description = "Statut"

    # Sécurité : Filtrage selon l'utilisateur (Chef d'axe vs Admin)
    def get_queryset(self, request):
        qs = super().get_queryset(request).select_related('axe')
        if request.user.is_superuser:
            return qs
        # Si vous utilisez votre fonction is_chef_axe définie plus haut
        from .admin import is_chef_axe
        if is_chef_axe(request.user):
            return qs.filter(axe__attache_suivi=request.user)
        return qs


@admin.register(MessageMarche)
class MessageMarcheAdmin(admin.ModelAdmin):
    list_display = ('marche', 'auteur', 'apercu', 'created_at')
    list_filter = ('created_at', 'auteur')
    search_fields = ('contenu', 'marche__num_marche', 'marche__resume')
    autocomplete_fields = ['marche']
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description="Message")
    def apercu(self, obj):
        return obj.contenu[:80] + ('…' if len(obj.contenu) > 80 else '')