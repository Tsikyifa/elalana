from django.shortcuts import render

# Create your views here.
# views.py

from .models import (
    Intervenant,
    Doleance,
    EtapePromesse,
    EtapeTraitement
)
from .serializers import *
from django.http import JsonResponse

from rest_framework.views import APIView
from rest_framework import viewsets,parsers, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed

class CustomAuthToken(ObtainAuthToken):

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']

        # 🔒 Autoriser uniquement admin
        if not (user.is_staff or user.is_superuser):
            raise AuthenticationFailed("Accès refusé : Admin uniquement")

        token, _ = Token.objects.get_or_create(user=user)

        response = JsonResponse({
            "message": "Login réussi",
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser
            }
        })

        # 🍪 Cookie sécurisé
        response.set_cookie(
            key="access",
            value=token.key,
            httponly=True,
            secure=True,
            samesite="Lax",
            path="/",
        )

        return response

class LogoutView(APIView):
    def post(self, request):
        response = Response({"message": "logout"})
        response.delete_cookie("access")
        return response

class IntervenantViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Intervenant.objects.all()
    serializer_class = IntervenantSerializer


class DoleanceViewSet(viewsets.ModelViewSet):

    queryset = Doleance.objects.all().order_by('-created_at')
    
    serializer_class = DoleanceSerializer
    # Indispensable pour bloquer l'AnonymousUser
    permission_classes = [permissions.IsAuthenticated] 
    
    # ParserClasses pour gérer le FormData (fichiers) envoyé par Next.js
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def perform_create(self, serializer):
        # On injecte l'utilisateur ici, c'est la méthode la plus propre en DRF
        serializer.save(responsable_insert=self.request.user)

class EtapeTraitementViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = EtapeTraitement.objects.all()
    serializer_class = EtapeTraitementSerializer


class PromesseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Promesse.objects.all()
    serializer_class = PromesseSerializer
    def perform_create(self, serializer):
        # On injecte automatiquement l'utilisateur connecté comme responsable
        serializer.save(responsable_insert=self.request.user)


class EtapePromesseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = EtapePromesse.objects.all()
    serializer_class = EtapePromesseSerializer

class LocalisationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Liste des localisations pour remplir les sélecteurs du frontend.
    """
    queryset = Localisation.objects.all().order_by('province', 'region', 'district')
    serializer_class = LocalisationSerializer
    # Désactive la pagination pour ce ViewSet si vous voulez tous les districts d'un coup
    pagination_class = None