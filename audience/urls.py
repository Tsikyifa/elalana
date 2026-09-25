from django.urls import path

from . import views

urlpatterns = [

    # Dashboard
    path(
        '',
        views.liste_demandes,
        name='liste_demandes'
    ),

    # Nouvelle demande
    path(
        'demande/nouveau/',
        views.creer_demande,
        name='creer_demande'
    ),

    # Détail demande
    path(
        'demande/<int:pk>/',
        views.detail_demande,
        name='detail_demande'
    ),

    # Programmer audience
    path(
        'demande/<int:pk>/programmer/',
        views.programmer_audience,
        name='programmer_audience'
    ),

    # Accepter audience
    path(
        'demande/<int:pk>/accepter/',
        views.accepter_audience,
        name='accepter_audience'
    ),

    # Refuser audience
    path(
        'demande/<int:pk>/refuser/',
        views.refuser_audience,
        name='refuser_audience'
    ),

    # Stand By
    path(
        'demande/<int:pk>/standby/',
        views.standby_audience,
        name='standby_audience'
    ),

    # Reporter audience
    path(
        'demande/<int:pk>/reporter/',
        views.reporter_audience,
        name='reporter_audience'
    ),

    # Rediriger vers SG, DIRCAB...
    path(
        'demande/<int:pk>/rediriger/',
        views.rediriger_audience,
        name='rediriger_audience'
    ),
]
