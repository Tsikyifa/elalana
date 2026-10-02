from django.contrib import admin

from .models import (
    Direction,
    DemandeAudience,
    BlocageAgenda,
    Historique,
    ReportAudience,
    PieceJointe,
)

@admin.register(Direction)
class DirectionAdmin(admin.ModelAdmin):

    list_display = (
        "code",
        "nom"
    )

    search_fields = (
        "code",
        "nom"
    )


@admin.register(DemandeAudience)
class DemandeAudienceAdmin(admin.ModelAdmin):

    list_display = (
        "numero",
        "nom_demandeur",
        "organisme",
        "telephone",
        "statut",
        "date_audience",
        "date_reception",
    )

    search_fields = (
        "numero",
        "nom_demandeur",
        "telephone",
        "organisme",
        "objet"
    )

    list_filter = (
        "statut",
        "date_reception",
        "date_audience",
        "direction_redirigee"
    )

    readonly_fields = (
        "numero",
        "date_reception",
        "date_modification"
    )

    date_hierarchy = "date_reception"

    list_per_page = 25

@admin.register(BlocageAgenda)
class BlocageAgendaAdmin(admin.ModelAdmin):

    list_display = (
        "debut",
        "fin",
        "motif",
        "cree_par"
    )

    search_fields = (
        "motif",
    )

@admin.register(Historique)
class HistoriqueAdmin(admin.ModelAdmin):
    list_display = (
        "date_action",
        "utilisateur",
        "action"
    )

@admin.register(ReportAudience)
class ReportAudienceAdmin(admin.ModelAdmin):

    list_display = (
        "demande",
        "ancienne_date",
        "nouvelle_date",
        "date_report",
        "reporte_par"
    )

    search_fields = (
        "demande__numero",
        "motif"
    )

    list_filter = (
        "date_report",
    )

@admin.register(PieceJointe)
class PieceJointeAdmin(admin.ModelAdmin):

    list_display = (
        "demande",
        "description"
    )

    search_fields = (
        "demande__numero",
        "description"
    )