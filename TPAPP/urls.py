"""
URL configuration for TPAPP project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponseRedirect
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.auth import views as auth_views
from django.shortcuts import redirect
from travaux.views import accueil
from apitp.views import CustomAuthToken, LogoutView

from dj_rest_auth.views import LoginView
from dj_rest_auth.registration.views import RegisterView
from rest_framework_simplejwt.views import TokenRefreshView

def redirect_to_admin(request) : 
    return HttpResponseRedirect('/admin/')
def redirect_to_reporting(request):
    return redirect('marche_reporting')

urlpatterns = [
    #authentification 
    path('api/auth/login/', CustomAuthToken.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    #path('api/auth/register/', RegisterView.as_view()),
    #path('api/auth/refresh/', TokenRefreshView.as_view()),
    #########
    path("admin/", admin.site.urls),
    #path("api/",include('om.urls')),
    path("api/",include('apitp.urls')),
    path("audience/",include('audience.urls')),

    path("travaux/",include('travaux.urls')),
     # 🔥 AJOUT IMPORTANT
    path('accounts/', include('django.contrib.auth.urls')),
    #path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),
    # path("",redirect_to_reporting,name='home'),
    path('', accueil, name='home'),
    
]


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
