# Fichier: permissions.py (à créer dans votre app)

from rest_framework import permissions

class CanEnterMissionData(permissions.BasePermission):
    """
    Autorisation personnalisée pour vérifier si l'utilisateur connecté 
    (via son CompteAgent) a le droit de saisir des données de mission.
    """
    message = "Vous n'êtes pas autorisé à créer ou modifier des missions."

    def has_permission(self, request, view):
        # L'utilisateur doit être authentifié (géré par IsAuthenticated)
        if not request.user.is_authenticated:
            return False

        # Si c'est une requête GET (lecture seule), nous l'autorisons toujours
        # Cela permet à tous les utilisateurs authentifiés de voir les missions.
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Pour les requêtes dangereuses (POST, PUT, PATCH, DELETE) :
        # Vérifier si l'utilisateur a un profil CompteAgent et si 'peut_saisir_donnees' est True.
        try:
            # Note: 'agent_profile' est le related_name dans CompteAgent
            return request.user.agent_profile.peut_saisir_donnees
        except AttributeError:
            # L'utilisateur n'a pas de profil CompteAgent lié
            return False