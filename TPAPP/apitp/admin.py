from django.contrib import admin

# Register your models here.

# admin.py

from .models import *

@admin.register(Doleance)
class DoleanceAdmin(admin.ModelAdmin):
    list_display = ('titre', 'type_autorite', 'statut', 'created_at')
    search_fields = ('titre', 'auteur')
    list_filter = ('statut', 'type_autorite')


@admin.register(EtapeTraitement)
class EtapeTraitementAdmin(admin.ModelAdmin):
    list_display = ('titre', 'doleance', 'date_debut', 'est_terminee')


@admin.register(Promesse)
class PromesseAdmin(admin.ModelAdmin):
    list_display = ('titre', 'statut', 'date_annonce')


admin.site.register(Intervenant)
admin.site.register(EtapePromesse)
admin.site.register(PieceJointe)