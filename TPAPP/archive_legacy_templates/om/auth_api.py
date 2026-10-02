# views.py (Avec Serializer)
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework.permissions import IsAuthenticated
# Importez votre Serializer
# from .serializers import LoginSerializer 


class LoginView(APIView):
    # serializer_class = LoginSerializer # Peut être utile pour la documentation OpenAPI/Swagger

    def post(self, request):
        # 1. Validation des données
        # serializer = LoginSerializer(data=request.data)
        # serializer.is_valid(raise_exception=True) 
        # username = serializer.validated_data["username"]
        # password = serializer.validated_data["password"]

        # ***************
        # Utilisation de votre logique actuelle :
        username = request.data.get("username")
        password = request.data.get("password")
        # ***************
        
        # 2. Authentification
        user = authenticate(username=username, password=password)

        if user is None:
             # Utilisation de status.HTTP_400_BAD_REQUEST est aussi courante ici 
             # pour indiquer un échec de validation des identifiants (au lieu de 401)
            return Response(
                {"detail": "Identifiants invalides."}, 
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        # 3. Génération des jetons
        refresh = RefreshToken.for_user(user)

        # 4. Réponse réussie (200 OK)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            # INFO COMPLÉMENTAIRE: Vous pouvez ajouter plus de données utilisateur ici
            "user": {
                "id": user.pk,
                "username": user.username,
                "email": user.email, # Si vous avez un champ email
                # ... autres champs que le front pourrait avoir besoin
            }
        }, status=status.HTTP_200_OK) # Précisez le statut 200 (implicite, mais plus clair)
    
class UserProfileView(APIView):
    # La clé de la vérification !
    permission_classes = [IsAuthenticated] 

    def get(self, request):
        # Cette méthode accepte GET et renvoie les données de l'utilisateur authentifié
        # Vous devez sérialiser l'objet request.user
        return Response({
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
        })