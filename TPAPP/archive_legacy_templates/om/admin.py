from django.contrib import admin
from django.utils.html import format_html
from .models import DirectionTP, Personneltp, Vehicle, Mission, Missionnaire, CompteAgent, VehicleStat

# -----------------------------
# Inlines
# -----------------------------
class VehicleStatInline(admin.TabularInline):
    model = VehicleStat
    extra = 1
    readonly_fields = ('date_maj',)

class MissionnaireInline(admin.TabularInline):
    model = Missionnaire
    extra = 1
    autocomplete_fields = ['IM']

# -----------------------------
# Admin Models
# -----------------------------

@admin.register(DirectionTP)
class DirectionTPAdmin(admin.ModelAdmin):
    list_display = ('DENOMINATION', 'SIGLE', 'hierarchie')
    search_fields = ('DENOMINATION', 'SIGLE')
    list_filter = ('hierarchie',)

@admin.register(Personneltp)
class PersonneltpAdmin(admin.ModelAdmin):
    list_display = ('Nom_prenom', 'IM', 'Fonction', 'direction')
    search_fields = ('Nom_prenom', 'IM')
    list_filter = ('direction',)

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    # On fusionne toutes les colonnes ici
    list_display = ('matricule', 'marque', 'get_situation', 'get_emplacement', 'display_etat', 'date_derniere_maj')
    list_filter = ('etat_technique', 'direction_rattache')
    search_fields = ('matricule', 'marque')
    inlines = [VehicleStatInline]

    # Méthodes pour récupérer les infos du dernier statut
    def get_situation(self, obj):
        last_stat = obj.dernier_statut
        return last_stat.get_situation_display() if last_stat else "Inconnu"
    get_situation.short_description = "Statut Actuel"

    def get_emplacement(self, obj):
        last_stat = obj.dernier_statut
        return last_stat.emplacement_actuel if last_stat else "-"
    get_emplacement.short_description = "Lieu"

    def date_derniere_maj(self, obj):
        last_stat = obj.dernier_statut
        return last_stat.date_maj.strftime("%d/%m/%Y %H:%M") if last_stat else "-"
    date_derniere_maj.short_description = "Dernière MAJ"

    def display_etat(self, obj):
        colors = {'Bon': '#28a745', 'Moyen': '#ffc107', 'Mauvais': '#dc3545'}
        return format_html(
            '<b style="color:{};">● {}</b>',
            colors.get(obj.etat_technique, 'black'),
            obj.get_etat_technique_display()
        )
    display_etat.short_description = "État"

@admin.register(Mission)
class MissionAdmin(admin.ModelAdmin):
    list_display = ('date_depart', 'date_arrivee', 'Motif', 'lieu', 'vehicule')
    list_filter = ('date_depart', 'vehicule')
    inlines = [MissionnaireInline]
    autocomplete_fields = ['vehicule']
    search_fields = ('id', 'Motif', 'lieu')

@admin.register(CompteAgent)
class CompteAgentAdmin(admin.ModelAdmin):
    list_display = ('user_username', 'personnel_im', 'get_direction', 'peut_saisir_donnees')
    search_fields = ('user__username', 'personnel__Nom_prenom', 'personnel__IM')
    list_filter = ('peut_saisir_donnees', 'personnel__direction')
    
    def user_username(self, obj):
        return obj.user.username
    
    def personnel_im(self, obj):
        return obj.personnel.IM
    
    def get_direction(self, obj):
        return obj.personnel.direction

@admin.register(VehicleStat)
class VehicleStatAdmin(admin.ModelAdmin):
    list_display = ('vehicule', 'situation', 'emplacement_actuel', 'missionnaire', 'date_maj')
    list_filter = ('situation', 'date_maj')