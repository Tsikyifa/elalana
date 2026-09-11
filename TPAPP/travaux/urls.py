from django.urls import path
from .views import (
    # Authentification & Stats
    CustomAuthToken, 
    StatistiqueDecisionnelleView,
    
    # Rapports & Travaux
    TravauxGlisseReportingView, 
    OSCreateView,
    
    # Gestion des Bacs
    BacListView, 
    BacCreateView, 
    BacUpdateView, 
    BacDeleteView,
    
    # Convention Programme (CP)
    CPListView, 
    CPCreateView, 
    CPUpdateView, 
    CPDeleteView
)
from . import views
from django.views.generic import TemplateView

urlpatterns = [
    path('login/', CustomAuthToken.as_view(), name='api_login'),
    path('reporting/', views.reporting_view, name='marche_reporting'),
    path('export/pkmarche/', views.export_pkmarche_csv, name='export_pkmarche'),
    # --- GESTION DES AXES ---
    path('axe/nouveau/', views.AxeCreateView.as_view(), name='axe_create'),
    path('axe/<uuid:pk>/modifier/', views.AxeUpdateView.as_view(), name='axe_update'),

    # --- GESTION DES MARCHÉS ---
    path('marche/nouveau/', views.MarcheCreateView.as_view(), name='marche_create'),
    path('marche/<uuid:pk>/modifier/', views.MarcheUpdateView.as_view(), name='marche_update'),
    path('marche/<uuid:pk>/', views.MarcheDetailView.as_view(), name='marche_detail'),

    # --- GESTION DES AVANCEMENTS ---
    # Ici, on passe l'ID du marché pour savoir à quoi lier l'avancement
    path('marche/<uuid:marche_id>/avancement/nouveau/', 
         views.AvancementCreateView.as_view(), 
         name='avancement_create'),
         
    path('export/reporting/pdf/', views.export_reporting_pdf, name='export_reporting_pdf'),
    # 2. La route pour la maintenance (BIEN SÉPARÉE ICI)
    path('maintenance/', 
         TemplateView.as_view(template_name="maintenance.html"), 
         name='maintenance'),
     path(
          "marche/<uuid:pk>/detail-modal/",
          views.marche_detail_modal,
          name="marche_detail_modal"
),
     path('marche/<uuid:marche_id>/os/nouveau/', OSCreateView.as_view(), name='os_create'),

     path(
     'marche/<uuid:pk>/supprimer/',
     views.MarcheDeleteView.as_view(),
     name='marche_delete'
),

     path('annuaire/', views.annuaire_list, name='annuaire_list'),

     # ... vos autres URLs ...
     path('avancement/<int:pk>/modifier/', views.AvancementUpdateView.as_view(), name='avancement_update'),
     path('avancement/<int:pk>/supprimer/', views.AvancementDeleteView.as_view(), name='avancement_delete'),
     
     path('os/<int:pk>/modifier/', views.OSUpdateView.as_view(), name='os_update'),
     path('os/<int:pk>/supprimer/', views.OSDeleteView.as_view(), name='os_delete'),

     path('bacs/', BacListView.as_view(), name='bac_list'),
     path('bacs/nouveau/', BacCreateView.as_view(), name='bac_add'),
     path('bacs/<int:pk>/modifier/', BacUpdateView.as_view(), name='bac_edit'),
     path('bacs/<int:pk>/supprimer/', BacDeleteView.as_view(), name='bac_delete'),

     path('conventions/', CPListView.as_view(), name='cp_list'),
     path('conventions/nouveau/', CPCreateView.as_view(), name='cp_add'),
     path('conventions/<int:pk>/modifier/', CPUpdateView.as_view(), name='cp_edit'),
     path('conventions/<int:pk>/supprimer/', CPDeleteView.as_view(), name='cp_delete'),
     # URL pour le reporting des glissements 2026
     path('reporting/glissements/<int:annee>/', 
          TravauxGlisseReportingView.as_view(), 
          name='glissement_reporting_annuel'), path('reporting/glissements/2026/', 
          TravauxGlisseReportingView.as_view(), 
          name='glissement_reporting_2026'),
     # Version simple (Statistiques globales)
     path('tableau-de-bord/', StatistiqueDecisionnelleView.as_view(), name='dashboard_stats'),
     path('projets-routiers/', views.projets_routiers_view, name='projets_routiers_menu'),

     path(
        'export/marches/',
        views.export_suivi_marches_excel,
        name='export_marches'
    ),
]