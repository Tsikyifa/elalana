from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Marche, PKMarche, Localisation, Avancement, Axe, OS, Annuaire, Bac, ConventionProgramme, TravauxGlisse
from .serializers import MarcheListSerializer
from .filters import MarcheReportingFilter
from .mixins import ChefAxeRequiredMixin, ChefMarcheRequiredMixin, SuiviPermissionMixin, AdminOrChefAxeMixin
from .forms import MarcheForm, PKMarcheFormSet, AvancementForm, MediaFormSet,AxeForm, PKDistrictFormSet, OSForm,PKDistrict, BacForm, CPForm, TravauxGlisseFormSet
from django.core.exceptions import PermissionDenied
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Prefetch, Q, Count, Sum, Avg
from django.http import HttpResponse, FileResponse, HttpResponseRedirect
from django.views.generic import UpdateView, CreateView, DetailView, DeleteView, ListView, TemplateView
from django.urls import reverse_lazy
from django.db import transaction

from openpyxl import Workbook
from openpyxl.utils import get_column_letter

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors, pagesizes

from collections import defaultdict
import csv
import io
    
class CustomAuthToken(ObtainAuthToken):

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser
        })
class MarcheStatusViewSet(viewsets.ReadOnlyModelViewSet):

    serializer_class = MarcheListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = Marche.objects.select_related(
            'axe'
        ).order_by('axe__designation')

        if user.is_superuser:
            return queryset

        return queryset.filter(axe__attache_suivi=user)

def staff_required(user):
    return user.is_staff
@login_required
def accueil(request):

    is_audience_op = request.user.groups.filter(
        name='AudienceOp'
    ).exists()

    is_audience = request.user.groups.filter(
        name__in=[
            'AudienceOp',
            'AudienceAssistant',
            'AudienceMinistre'
        ]
    ).exists()

    context = {
        'is_audience_op': is_audience_op,
        'is_audience': is_audience,
    }

    return render(
        request,
        "accueil.html",
        context
    )

@login_required
def reporting_view(request):
    user=request.user
    # Vérification des groupes
    status_scope = request.GET.get('status_scope', 'active')
    is_viewer = user.groups.filter(name='viewer').exists()
    is_chef_axe = user.groups.filter(name='chef_d_axe').exists()
    edit_mode = request.GET.get('edit') == 'true' # Simulé par un paramètre URL ou session
    queryset = Marche.objects.select_related(
        'axe'
    ).prefetch_related(
        'ordres_service',
        'segments_pk',
        'avancements',
        'axe__segments_districts__district'
    ).order_by('axe__designation').distinct()

    # LOGIQUE DE FILTRAGE PAR STATUT
    if status_scope == 'active':
        # On combine : ceux qui sont cochés "Anticipé" 
        # OU ceux dont l'étape est "En cours d'Exécution"
        queryset = queryset.filter(
            Q(est_anticipe=True) | Q(etape_actuelle='EXE')
        )

    if status_scope == 'anticipe':
        # On combine : ceux qui sont cochés "Anticipé" 
        # OU ceux dont l'étape est "En cours d'Exécution"
        queryset = queryset.filter(
            Q(est_anticipe=True)
        )
    
    elif status_scope == 'inactive':
        # Marchés qui ne sont PAS anticipés ET qui ne sont PAS en exécution
        # (ex: En étude, Dossier visé, AO Lancé, etc.)
        queryset = queryset.exclude(
            Q(est_anticipe=True) | Q(etape_actuelle='EXE')
        )
    # LOGIQUE DE FILTRAGE
    if edit_mode:
        if user.is_superuser:
            # Le superuser voit tout en édition
            pass 
        elif is_chef_axe:
            # Le Chef d'Axe ne voit QUE ses marchés en mode édition
            queryset = queryset.filter(axe__attache_suivi=user)
        else:
            # Un simple "Viewer" ne devrait pas avoir de résultats en mode édition
            queryset = queryset.none()
    else:
        # MODE VUE : Tout le monde voit tout (ou selon votre politique)
        # Si vous voulez que même en vue ils ne voient que leur axe, gardez votre filtre :
        # if not user.is_superuser: queryset = queryset.filter(axe__attache_suivi=user)
        pass

    view_type = request.GET.get('view_type', 'axe')
    search_query = request.GET.get('q') # 1. On récupère la recherche

    # 2. Application de la recherche textuelle
    if search_query:
        queryset = queryset.filter(
            Q(description__icontains=search_query) | 
            Q(resume__icontains=search_query) | 
            Q(titulaire__icontains=search_query) |
            Q(num_marche__icontains=search_query)
        )

    #if not request.user.is_superuser:
    #    queryset = queryset.filter(axe__attache_suivi=request.user)
    f = MarcheReportingFilter(request.GET, queryset=queryset)
    marches = f.qs.distinct()
    # =====================================================
# STRUCTURE TITULAIRE
# =====================================================

    titulaire_structure = defaultdict(lambda: defaultdict(list))

    if view_type == 'titulaire':
       
        for marche in marches:

            titulaire_name = marche.titulaire or "Non défini"
            axe_name = marche.axe.designation if marche.axe else "Sans Axe"

            titulaire_structure[titulaire_name][axe_name].append(marche)
        

    titulaire_final = {
        titulaire: dict(axes) 
        for titulaire, axes in titulaire_structure.items()
    }
    # =====================================================
    # STRUCTURE REGION
    # =====================================================
    region_structure = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    for marche in marches:

        districts = marche.districts_touches  # ✅ CORRECTION

        if not districts:
            continue

        for district in districts:

            region_display = district.get_region_display()
            district_name = district.district
            axe_name = marche.axe.designation

            region_structure[region_display][district_name][axe_name].append(marche)

    # TRI
    sorted_region_structure = {
        region: {
            district: {
                axe: region_structure[region][district][axe]
                for axe in sorted(region_structure[region][district])
            }
            for district in sorted(region_structure[region])
        }
        for region in sorted(region_structure)
    }

    # FILTRE REGION SI SELECTIONNEE
    selected_region_code = request.GET.get('region')

    if selected_region_code:
        region_label = dict(Localisation.REGION_CHOICES).get(selected_region_code)
        sorted_region_structure = {
            k: v for k, v in sorted_region_structure.items()
            if k == region_label
        }

    # =====================================================
    # STRUCTURE PK
    # =====================================================
    pk_structure = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )

    if view_type == 'pk':
        pk_structure = defaultdict(list)
        
        # --- MODIFICATION ICI : On lie pk_list au filtre ---
        queryset_segments_axe = PKDistrict.objects.select_related('district')
        # On ne prend que les segments PK dont le MARCHÉ correspond aux filtres (Axe, Région, etc.)
        # 2. On lie pk_list au filtre avec prefetch_related intelligent
        pk_list = PKMarche.objects.filter(
            marche__in=f.qs
        ).select_related(
            'marche__axe'
        ).prefetch_related(
            'marche__avancements',
            'marche__ordres_service', # Nécessaire pour avancement_temporel
            Prefetch(
                'marche__axe__segments_districts', 
                queryset=queryset_segments_axe,
                to_attr='segments_prefetches' # On stocke le résultat dans une liste Python
            )
        ).order_by('marche__axe__designation', 'pk_debut')

        # Prend le premier objet de la liste pour inspecter ses clés
 

        for pk in pk_list:
            marche = pk.marche
            axe = marche.axe
            
            # --- CALCUL OPTIMISÉ DE LA RÉGION ---
            # Au lieu de .filter() (SQL), on utilise une boucle Python sur la liste préchargée
            regions_portion = set()

  
            for sa in axe.segments_prefetches: # Liste déjà en mémoire
            # Logique d'intersection spatiale en Python (ultra rapide)
                if sa.pk_debut < pk.pk_fin and sa.pk_fin > pk.pk_debut:
                    if sa.district:
                        regions_portion.add(sa.district.get_region_display().strip().upper())
        
            region_display = ", ".join(sorted(regions_portion)) if regions_portion else "N/A"

            # Récupération du dernier avancement
            last = marche.avancements.first()
            #last_obj = marche.avancements.first()
            # TEST DE SÉCURITÉ
            if last is not None:
                print("Oui : ", last.avancement_physique)
                physique = last.avancement_physique
                situation = last.get_situation_w_display()
            else:
                print("Info : Aucun avancement pour ce marché")
                physique = 0
                situation = "-"
            lineaire = pk.pk_fin - pk.pk_debut
            #print("Marché : ", marche.financement)
            data = {
                'pk_debut': pk.pk_debut,
                'id':marche.id,
                'pk_fin': pk.pk_fin,
                'tiers':marche.tiers,
                'lineaire': lineaire,
                'region': region_display,
                'num_marche': marche.num_marche,
                'description':marche.description,
                'titulaire': marche.titulaire,
                'financement':marche.financement,
                'last': marche.avancements.first(),
                'temporel': last.avancement_temporel if (last and hasattr(last, 'avancement_temporel')) else 0, # Utilise la nouvelle logique OS 
                'date_fin': marche.date_fin_actualisee, # Utilise la date qui bouge avec les arrêts
                'situation': last.get_situation_w_display() if last else '-',
                'color_class': 'success' if last and last.avancement_physique >= 80 else 'warning' if last and last.avancement_physique >= 40 else 'danger'
            }
            #pk.region_display = region_display
            #pk_structure[axe.designation].append(pk)

            pk_structure[axe.designation].append(data)

    # Conversion finale pour le template
    pk_final = {axe: segments for axe, segments in pk_structure.items()}

    #pk_final = {axe: segments for axe, segments in pk_structure.items()}


    # =====================================================
    # STATISTIQUES
    # =====================================================


    context = {
        'filter': f,
        'marches': marches,
        'region_structure': sorted_region_structure,
        'view_type': view_type,
        'pk_structure': pk_final, #pk_structure,
        'titulaire_structure': titulaire_final, #titulaire_structure,
        'is_chef_axe': is_chef_axe,
        'is_viewer': is_viewer,
        "is_dgtpadmin": request.user.groups.filter(
            name="dgtpadmin"
        ).exists(),
        'status_scope': status_scope,
    }

    return render(request, 'reporting/marche_report.html', context)

@login_required
def export_reporting_pdf(request):

    queryset = Marche.objects.select_related('axe')
    f = MarcheReportingFilter(request.GET, queryset=queryset)
    marches = f.qs

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=pagesizes.A4)
    elements = []

    styles = getSampleStyleSheet()

    elements.append(Paragraph("RAPPORT DES MARCHÉS 2026", styles['Heading1']))
    elements.append(Spacer(1, 20))

    data = [["Marché", "Axe", "Financement"]]

    for m in marches:
        data.append([
            m.num_marche,
            m.axe.designation,
            m.get_financement_display()
        ])

    table = Table(data)
    table.setStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
    ])

    elements.append(table)
    doc.build(elements)

    buffer.seek(0)
    # Authorization: restrict PDF export to staff or axe-attached users
    if not request.user.is_superuser:
        # If any marche in the export is outside user's axe, deny
        for m in marches:
            if not m.axe or m.axe.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé")
    return FileResponse(buffer, as_attachment=True, filename="reporting.pdf")
# Export CSV
def export_pkmarche_csv(request):

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="pkmarche_export.csv"'

    writer = csv.writer(response)

    # En-tête
    writer.writerow([
        'Marché',
        'Axe',
        'PK Début',
        'PK Fin',
        'Longueur',
        'Description'
    ])

    pk_list = PKMarche.objects.select_related('marche__axe')

    for pk in pk_list:
        writer.writerow([
            pk.marche.num_marche,
            pk.marche.axe.designation,
            pk.pk_debut,
            pk.pk_fin,
            float(pk.pk_fin - pk.pk_debut),
            pk.description
        ])

    # Authorization: restrict CSV export to staff or axe-attached users
    if not request.user.is_superuser:
        for pk in pk_list:
            if not pk.marche.axe or pk.marche.axe.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé")
    return response

class MarcheUpdateView(LoginRequiredMixin, ChefMarcheRequiredMixin, UpdateView):
    model = Marche
    form_class = MarcheForm
    template_name = 'travaux/marche_form.html'
    success_url = reverse_lazy('marche_reporting')

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            #data['segments'] = PKMarcheFormSet(self.request.POST, instance=self.object)
            data['segments'] = PKMarcheFormSet(self.request.POST, instance=self.object, prefix='segments_pk')
            data['glissement'] = TravauxGlisseFormSet(self.request.POST, instance=self.object, prefix='glissements')
            #data['glissement'] = TravauxGlisseFormSet(self.request.POST, instance=self.object) # <-- AJOUT
        else:
            data['segments'] = PKMarcheFormSet(instance=self.object, prefix='segments_pk')
            data['glissement'] = TravauxGlisseFormSet(instance=self.object, prefix='glissements')
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        segments = context['segments']
        glissement = context['glissement']
        
        if form.is_valid() and segments.is_valid() and glissement.is_valid():
            with transaction.atomic():
                self.object = form.save()
                segments.save()
                
                # Sauvegarde du glissement avec mise à jour de l'axe au cas où il a changé
                glisse_instances = glissement.save(commit=False)
                for instance in glisse_instances:
                    instance.axe = self.object.axe
                    instance.save()
                glissement.save()
                
            return HttpResponseRedirect(self.get_success_url())
        else:
            return self.render_to_response(self.get_context_data(form=form, segments=segments, glissement=glissement))
        
    
class AvancementCreateView(LoginRequiredMixin, ChefMarcheRequiredMixin, CreateView):
    model = Avancement
    form_class = AvancementForm
    template_name = 'travaux/avancement_form.html'

    def dispatch(self, request, *args, **kwargs):
        # On récupère le marché dès le début
        self.marche = get_object_or_404(Marche, pk=self.kwargs.get('marche_id'))
        return super().dispatch(request, *args, **kwargs)
    
    def dispatch(self, request, *args, **kwargs):
        self.marche = get_object_or_404(Marche, pk=self.kwargs.get('marche_id'))

        if not request.user.is_superuser and self.marche.axe.attache_suivi != request.user:
            raise PermissionDenied("Vous ne pouvez pas ajouter d’avancement ici.")

        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['marche'] = self.marche
        if self.request.POST:
            context['medias'] = MediaFormSet(self.request.POST, self.request.FILES)
        else:
            context['medias'] = MediaFormSet()
        return context

    def form_valid(self, form):
        context = self.get_context_data()
        medias = context['medias']
        
        # On lie manuellement le marché à l'avancement avant de valider
        form.instance.marche = self.marche
        dernier_os = self.marche.ordres_service.order_by('-date_os').first()
        if dernier_os and dernier_os.type_os == 'ARRET':
            # On peut autoriser la saisie mais avec un avertissement, 
            # ou forcer le statut à 'Arrete'
            form.instance.situation_w = 'Arrete'
        if form.is_valid() and medias.is_valid():
            with transaction.atomic():
                self.object = form.save()
                medias.instance = self.object
                medias.save()
            return redirect('marche_detail', pk=self.marche.pk)
        else:
            return self.render_to_response(self.get_context_data(form=form, medias=medias))
        

class AvancementUpdateView(LoginRequiredMixin, AdminOrChefAxeMixin, UpdateView):
    model = Avancement
    form_class = AvancementForm
    #fields = ['date_avancement', 'situation_w', 'avancement_physique', 'avancement_financier', 'detail_situation', 'observation']
    template_name = 'travaux/avancement_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # On injecte 'marche' pour que le template existant fonctionne sans modif
        context['marche'] = self.object.marche 
        return context
    def get_success_url(self):
        return reverse_lazy('marche_detail', kwargs={'pk': self.object.marche.pk})

class AvancementDeleteView(LoginRequiredMixin, AdminOrChefAxeMixin, DeleteView):
    model = Avancement
    
    def get_success_url(self):
        marche_pk = self.object.marche.pk
        return reverse_lazy('marche_detail', kwargs={'pk': marche_pk})



class AxeUpdateView(LoginRequiredMixin,SuiviPermissionMixin, UpdateView):
    model = Axe
    form_class = AxeForm
    template_name = 'travaux/axe_form.html' # Réutilise le même template
    success_url = reverse_lazy('marche_reporting')

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            # On lie le formset à l'instance existante (self.object)
            data['segments'] = PKDistrictFormSet(self.request.POST, instance=self.object)
        else:
            data['segments'] = PKDistrictFormSet(instance=self.object)
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        segments = context['segments']
        if form.is_valid() and segments.is_valid():
            with transaction.atomic():
                self.object = form.save()
                segments.save()
            return HttpResponseRedirect(self.get_success_url())
        return self.render_to_response(self.get_context_data(form=form, segments=segments))
    
# --- VUE : CRÉER UN AXE ---


class AxeCreateView(LoginRequiredMixin, CreateView):
    model = Axe
    form_class = AxeForm
    template_name = 'travaux/axe_form.html'
    success_url = reverse_lazy('marche_reporting')

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['segments'] = PKDistrictFormSet(self.request.POST)
        else:
            data['segments'] = PKDistrictFormSet()
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        segments = context['segments']
        
        # On valide les deux manuellement
        if form.is_valid() and segments.is_valid():
            with transaction.atomic():
                form.instance.attache_suivi = self.request.user
                self.object = form.save() # Sauvegarde l'Axe
                segments.instance = self.object # Lie les segments à l'Axe
                segments.save() # Sauvegarde les segments
            
            return HttpResponseRedirect(self.get_success_url())
        else:
            # Si invalide, on renvoie le formulaire avec les erreurs (Code 200)
            return self.render_to_response(self.get_context_data(form=form, segments=segments))


class MarcheCreateView(LoginRequiredMixin, CreateView):
    model = Marche
    form_class = MarcheForm
    template_name = 'travaux/marche_form.html'
    success_url = reverse_lazy('marche_reporting')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        return kwargs

    def get_context_data(self, **kwargs):
        data = super().get_context_data(**kwargs)
        if self.request.POST:
            data['segments'] = PKMarcheFormSet(self.request.POST, prefix='segments_pk')
            data['glissement'] = TravauxGlisseFormSet(self.request.POST, prefix='glissements')
            #data['segments'] = PKMarcheFormSet(self.request.POST)
            #data['glissement'] = TravauxGlisseFormSet(self.request.POST) # <-- AJOUT
        else:
            data['segments'] = PKMarcheFormSet(prefix='segments_pk')
            data['glissement'] = TravauxGlisseFormSet(prefix='glissements')
            #data['segments'] = PKMarcheFormSet()
            #data['glissement'] = TravauxGlisseFormSet() # <-- AJOUT
        return data

    def form_valid(self, form):
        context = self.get_context_data()
        segments = context['segments']
        glissement = context['glissement'] # <-- RÉCUPÉRATION

        if form.is_valid() and segments.is_valid() and glissement.is_valid():
            with transaction.atomic():
                # 1. Sauvegarde du Marché
                self.object = form.save()
                
                # 2. Liaison et sauvegarde des Segments PK
                segments.instance = self.object
                segments.save()
                
                # 3. Liaison et sauvegarde du Glissement
                glissement.instance = self.object
                # On injecte l'axe du marché dans le glissement avant de sauver
                glisse_instances = glissement.save(commit=False)
                for instance in glisse_instances:
                    instance.axe = self.object.axe
                    instance.save()
                glissement.save_m2m() # Important si vous ajoutez des ManyToMany plus tard
                
                return HttpResponseRedirect(self.get_success_url())
        else:
            return self.render_to_response(self.get_context_data(form=form, segments=segments, glissement=glissement))
# --- VUE : DÉTAIL DU MARCHÉ (Timeline) ---

class MarcheDetailView(DetailView):
    model = Marche
    template_name = 'travaux/marche_detail.html'
    context_object_name = 'marche'

    def dispatch(self, request, *args, **kwargs):
        # Authorization: only staff or users attached to the axe can view details
        obj = self.get_object()
        if not request.user.is_superuser:
            if not obj.axe or obj.axe.attache_suivi != request.user:
                raise PermissionDenied("Accès refusé")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # Récupération de l'historique des avancements avec leurs images
        context['avancements'] = self.object.avancements.all().prefetch_related('medias')
        
        # Récupération des Ordres de Service (OS) triés par date
        # (Vérifiez si related_name='ordres_service' est défini dans votre modèle OS)
        context['ordres_service'] = self.object.ordres_service.all().order_by('-date_os')
        print ("le contexte est :", context)
        return context

@login_required
def marche_detail_modal(request, pk):
    marche = get_object_or_404(Marche, pk=pk)
    if not request.user.is_superuser and (not marche.axe or marche.axe.attache_suivi != request.user):
        raise PermissionDenied("Accès refusé")

    avancements = marche.avancements.all().order_by('-date_avancement')

    ordres_service = marche.ordres_service.all().order_by('-date_os')

    return render(request,
        "reporting/affich_part/marche_detail_modal.html",
        {
            "marche": marche,
            "avancements": avancements,
            "ordres_service": ordres_service # Ajout ici
        }
    )


class OSCreateView(LoginRequiredMixin, CreateView):
    model = OS
    form_class = OSForm
    template_name = 'travaux/os_form.html'

    def dispatch(self, request, *args, **kwargs):
        # On récupère le marché via l'UUID dans l'URL
        self.marche = get_object_or_404(Marche, pk=self.kwargs.get('marche_id'))
        # Authorization: only staff or attached axe user can create OS
        if not request.user.is_superuser and (not self.marche.axe or self.marche.axe.attache_suivi != request.user):
            raise PermissionDenied("Accès refusé")
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        # C'EST ICI QUE ÇA SE JOUE : On ajoute 'marche' au contexte
        context = super().get_context_data(**kwargs)
        context['marche'] = self.marche
        return context

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['marche'] = self.marche 
        return kwargs

    def form_valid(self, form):
        form.instance.marche = self.marche
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('marche_detail', kwargs={'pk': self.marche.pk})

class OSUpdateView(LoginRequiredMixin, AdminOrChefAxeMixin, UpdateView):
    model = OS
    form_class = OSForm
    #fields = ['type_os', 'date_os', 'delai_supplementaire', 'delai_unit', 'commentaire']
    template_name = 'travaux/os_form.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # On récupère le marché lié à l'OS en cours d'édition
        context['marche'] = self.object.marche 
        return context
    def get_success_url(self):
        return reverse_lazy('marche_detail', kwargs={'pk': self.object.marche.pk})

class OSDeleteView(LoginRequiredMixin, AdminOrChefAxeMixin, DeleteView):
    model = OS

    def get_success_url(self):
        marche_pk = self.object.marche.pk
        return reverse_lazy('marche_detail', kwargs={'pk': marche_pk})


@login_required
def annuaire_list(request):
    # 1. Récupération des paramètres proprement (nettoyage des espaces)
    query = request.GET.get('q', '').strip()
    region_filter = request.GET.get('region', '').strip()
    
    # 2. QuerySet de base (ordonné par région puis fonction)
    contacts = Annuaire.objects.all().order_by('region', 'fonction')

    # 3. Filtrage par recherche textuelle
    if query:
        contacts = contacts.filter(
            Q(nom__icontains=query) |
            Q(fonction__icontains=query) | 
            Q(telephone__icontains=query) |
            Q(telephone1__icontains=query) |
            Q(email__icontains=query)
        )
    
    # 4. Filtrage par Région
    # Ici, 'region' dans Annuaire est un CharField stockant par ex: 'ANALAMANGA'
    if region_filter:
        contacts = contacts.filter(region=region_filter)

    # 5. Utilisation exacte des choix du modèle pour le template
    # On utilise Localisation.REGION_CHOICES pour que les 'value' du <select> 
    # correspondent aux données stockées dans Annuaire.region
    regions = Localisation.REGION_CHOICES

    return render(request, 'annuaire/annuaire_list.html', {
        'contacts': contacts,
        'regions': regions,
        'query': query, # On renvoie pour garder le texte dans l'input
        'region_selected': region_filter, # Pour garder la sélection
    })


class BacListView(LoginRequiredMixin, ListView):
    model = Bac
    template_name = 'bac/bac_list.html'
    context_object_name = 'bacs'
    ordering = ['region', 'axe', 'pk_bac']

    def get_queryset(self):
        # Optimisation : on récupère l'axe lié en une seule requête SQL
        queryset = super().get_queryset().select_related('axe')
        
        query = self.request.GET.get('q', '').strip()
        region = self.request.GET.get('region', '').strip()
        etat = self.request.GET.get('etat', '').strip()

        if query:
            queryset = queryset.filter(
                Q(localite__icontains=query) | 
                Q(axe__designation__icontains=query) |
                Q(riviere__icontains=query) |
                Q(gestionnaire__icontains=query) |
                Q(constructeur__icontains=query)
            )
        if region:
            queryset = queryset.filter(region=region)
        if etat:
            queryset = queryset.filter(etat_bac=etat)
            
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # 1. Calcul des statistiques dynamiques sur le queryset filtré
        current_qs = self.get_queryset()
        
        stats = current_qs.aggregate(
            total=Count('id'),
            operationnel=Count('id', filter=Q(etat_bac='Operationel')),
            maintenance=Count('id', filter=Q(etat_bac='En maintenance')),
            degrade=Count('id', filter=Q(etat_bac__in=['Fonctionnel_degrade', 'degrade'])),
            hors_usage=Count('id', filter=Q(etat_bac='Hors_usage')),
            besoin_total=Sum('besoin_entretien_bac')
        )
        
        # On prépare un dictionnaire propre pour le template
        context['etats_count'] = {
            'Total': stats['total'] or 0,
            'Operationel': stats['operationnel'] or 0,
            'Maintenance': stats['maintenance'] or 0,
            'Degrade': stats['degrade'] or 0,
            'Hors_usage': stats['hors_usage'] or 0,
            'Besoin_Total': stats['besoin_total'] or 0,
        }

        # 2. Données pour les menus déroulants (Filtres)
        # On trie les régions par nom pour une meilleure ergonomie
        raw_regions = list(Localisation.REGION_CHOICES)
        context['regions'] = sorted(raw_regions, key=lambda x: x[1])
        context['etats'] = Bac.ETAT_CHOICES
        
        # 3. Maintien de l'état des filtres dans le formulaire
        context['q'] = self.request.GET.get('q', '')
        context['region_selected'] = self.request.GET.get('region', '')
        context['etat_selected'] = self.request.GET.get('etat', '')
        
        return context

class BacCreateView(LoginRequiredMixin, CreateView):
    model = Bac
    form_class = BacForm
    template_name = 'bac/bac_form.html'
    success_url = reverse_lazy('bac_list')

class BacUpdateView(LoginRequiredMixin, UpdateView):
    model = Bac
    form_class = BacForm
    template_name = 'bac/bac_form.html'
    success_url = reverse_lazy('bac_list')
    
class BacDeleteView(LoginRequiredMixin, DeleteView):
    model = Bac
    template_name = 'bac/bac_confirm_delete.html'
    success_url = reverse_lazy('bac_list')


class CPListView(ListView):
    model = ConventionProgramme
    template_name = 'cp/cp_list.html'
    context_object_name = 'conventions'
    ordering = ['region', 'axe__designation', '-annee', 'pk_debut']

    def get_queryset(self):
        # On utilise select_related pour éviter les requêtes N+1 sur l'axe
        queryset = super().get_queryset().select_related('axe')
        
        query = self.request.GET.get('q', '').strip()
        region = self.request.GET.get('region', '').strip()
        surface = self.request.GET.get('surface', '').strip()
        annee = self.request.GET.get('annee', '').strip()

        if query:
            queryset = queryset.filter(
                Q(section__icontains=query) | 
                Q(axe__designation__icontains=query) |
                Q(localite_deb__icontains=query) |
                Q(localite_fin__icontains=query)
            )
        if region: queryset = queryset.filter(region=region)
        if surface: queryset = queryset.filter(nature_surface=surface)
        if annee: queryset = queryset.filter(annee=annee)

        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # --- CALCUL DES STATISTIQUES (Sur le queryset filtré) ---
        current_qs = self.get_queryset()
        stats = current_qs.aggregate(
            total_count=Count('id'),
            total_km=Sum('longueur'),
            total_budget=Sum('montant_souhaite'),
            total_bugetmin=Sum('montant_minima'),
            # Stats par type de surface
            count_rb=Count('id', filter=Q(nature_surface='RB')),
            km_rb=Sum('longueur', filter=Q(nature_surface='RB')),
            count_rt=Count('id', filter=Q(nature_surface='RT')),
            km_rt=Sum('longueur', filter=Q(nature_surface='RT')),
        )

        # On injecte les stats proprement
        context['stats'] = stats
        
        # --- LISTES POUR LES FILTRES ---
        raw_regions = list(Localisation.REGION_CHOICES)
        context['regions'] = sorted(raw_regions, key=lambda x: x[1])
        context['surfaces'] = ConventionProgramme.SURFACE_CHOICES
        context['annees'] = ConventionProgramme.objects.values_list('annee', flat=True).distinct().order_by('-annee')
        
        # --- MAINTIEN DE L'ÉTAT DES FILTRES ---
        context['q'] = self.request.GET.get('q', '')
        context['region_selected'] = self.request.GET.get('region', '')
        context['surface_selected'] = self.request.GET.get('surface', '')
        context['annee_selected'] = self.request.GET.get('annee', '')
        
        return context


class CPCreateView(LoginRequiredMixin, CreateView):
    model = ConventionProgramme
    form_class = CPForm
    template_name = 'cp/cp_form.html'
    success_url = reverse_lazy('cp_list')

class CPUpdateView(LoginRequiredMixin, UserPassesTestMixin, UpdateView):
    model = ConventionProgramme
    form_class = CPForm
    template_name = 'cp/cp_form.html'
    success_url = reverse_lazy('cp_list')

    def test_func(self):
        return self.request.user.is_superuser

class CPDeleteView(LoginRequiredMixin, UserPassesTestMixin, DeleteView):
    model = ConventionProgramme
    template_name = 'cp/cp_confirm_delete.html'
    success_url = reverse_lazy('cp_list')

    def test_func(self):
        return self.request.user.is_superuser

class TravauxGlisseReportingView(LoginRequiredMixin, ListView):
    model = TravauxGlisse
    template_name = 'travaux/reporting_glissements.html'
    context_object_name = 'glissements'

    def get_queryset(self):
        # On récupère l'année directement depuis l'URL
        self.annee = self.kwargs.get('annee', 2026) 
        return TravauxGlisse.objects.filter(annee_report=self.annee).select_related('marche', 'axe')

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['annee_filtre'] = self.annee
        return context
    


class StatistiqueDecisionnelleView(TemplateView):
    template_name = 'stats/dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        
        # 1. Récupération des derniers avancements (IDs uniquement pour éviter l'erreur NotImplementedError)
        derniers_av_ids = Avancement.objects.order_by('marche', '-date_avancement').distinct('marche').values_list('id', flat=True)
        derniers_avancements = Avancement.objects.filter(id__in=derniers_av_ids).select_related('marche')

        # 2. Définition des types de financement et des états
        financements = ['RPI', 'FR', 'FIN_EX', 'AUTRE']
        etats = ['En_ph', 'En_passation', 'En_cours', 'Arrete', 'Acheve']
        
        # 3. Construction de la matrice (Tableau Croisé)
        recap_financement = []
        total_global_cols = {etat: 0 for etat in etats}
        total_global_marches = 0
        total_global_retard = 0

        for fin in financements:
            ligne = {'type': fin, 'details': {}, 'total_ligne': 0, 'retard_ligne': 0}
            
            # Filtrer les avancements par type de financement du marché lié
            av_fin = derniers_avancements.filter(marche__financement=fin)
            
            for etat in etats:
                count = av_fin.filter(situation_w=etat).count()
                ligne['details'][etat] = count
                ligne['total_ligne'] += count
                total_global_cols[etat] += count
            
            # Calcul des retards pour ce financement
            # Un marché est en retard si av_temporel > av_physique
            retard_count = 0
            for av in av_fin:
                if av.est_en_retard:
                    retard_count += 1
            
            ligne['retard_ligne'] = retard_count
            total_global_retard += retard_count
            total_global_marches += ligne['total_ligne']
            recap_financement.append(ligne)

        # Ajout au contexte
        context['recap_financement'] = recap_financement
        context['total_global_cols'] = total_global_cols
        context['total_global_marches'] = total_global_marches
        context['total_global_retard'] = total_global_retard
        context['etats_labels'] = etats 
        # Pour les entêtes du tableau
        # --- 2. STATISTIQUES BACS (KPI Maintenance) ---
        bacs = Bac.objects.all()
        context['total_bacs'] = bacs.count()
        context['bacs_operationnels'] = bacs.filter(etat_bac='Operationel').count()
        context['bacs_hors_usage'] = bacs.filter(etat_bac='Hors_usage').count()
        context['besoin_total_bac'] = bacs.aggregate(Sum('besoin_entretien_bac'))['besoin_entretien_bac__sum'] or 0
        
        # Répartition par propulsion (utile pour la logistique carburant/pièces)
        context['propulsion_stats'] = bacs.values('propulsion').annotate(total=Count('id'))

        # --- 3. CONVENTIONS PROGRAMMES (Planification) ---
        conventions = ConventionProgramme.objects.filter(annee=2026)
        context['total_conv_2026'] = conventions.count()
        context['longueur_totale_conv'] = conventions.aggregate(Sum('longueur'))['longueur__sum'] or 0
        context['montant_souhaite_conv'] = conventions.aggregate(Sum('montant_souhaite'))['montant_souhaite__sum'] or 0

        # --- 4. GLISSEMENTS (Alerte Budgétaire) ---
        glissements = TravauxGlisse.objects.filter(annee_report=2026)
        context['reliquat_total_2026'] = glissements.aggregate(Sum('montant_reliquat'))['montant_reliquat__sum'] or 0
        context['auc_obtenues'] = glissements.filter(auc='Obtenue').count()
        context['auc_en_attente'] = glissements.filter(auc='En attente').count()

        return context
    

def projets_routiers_view(request):
    return render(request, 'reporting/projet_routier_accueil.html')


class MarcheDeleteView(
    LoginRequiredMixin,
    UserPassesTestMixin,
    DeleteView
):
    model = Marche
    template_name = "travaux/marche_confirm_delete.html"

    def test_func(self):
        return self.request.user.groups.filter(
            name='dgtpadmin'
        ).exists()

    def get_success_url(self):
        return reverse_lazy('marche_reporting')
@login_required
def export_suivi_marches_excel(request):

    marches = Marche.objects.select_related(
        'axe'
    ).prefetch_related(
        'avancements',
        'segments_pk'
    )


    wb = Workbook()

    ws = wb.active
    ws.title = "Suivi Marchés"


    # Entête Excel

    ws.append([

        "N° Marché",
        "Marché",
        "Axe",

        "Entreprise titulaire",
        "Mission de contrôle (MDC)",
        "Direction de suivi",

        "Financement",

        "Date OS Commencement",

        "Date dernier avancement",

        "Avancement physique (%)",
        "Avancement temporel (%)",
        "Avancement financier (%)",

        "Etat",

        "Retard",

        "Districts traversés"

    ])


    for marche in marches:


        # ===============================
        # Dernier avancement
        # ===============================

        dernier_av = (
            marche.avancements
            .order_by('-date_avancement')
            .first()
        )


        if dernier_av:

            date_dernier_avancement = (
                dernier_av.date_avancement
            )

            av_physique = (
                dernier_av.avancement_physique
                or 0
            )

            av_temporel = (
                dernier_av.avancement_temporel
            )

            av_financier = (
                dernier_av.avancement_financier
                or 0
            )

            etat = (
                dernier_av.get_situation_w_display()
            )

            retard = (
                "OUI"
                if dernier_av.est_en_retard
                else "NON"
            )


        else:

            date_dernier_avancement = None
            av_physique = 0
            av_temporel = 0
            av_financier = 0
            etat = "Aucun avancement"
            retard = "NON"



        # ===============================
        # Districts traversés
        # ===============================

        districts = marche.districts_touches


        districts_text = ", ".join(
            [
                d.district
                for d in districts
            ]
        )



        # ===============================
        # Ligne Excel
        # ===============================

        ws.append([


            marche.num_marche or "",


            marche.resume or "",


            marche.axe.designation
            if marche.axe
            else "",



            # Entreprise titulaire
            marche.titulaire or "",



            # Mission de contrôle
            marche.tiers or "",



            # Direction suivi
            marche.get_responsable_display()
            if marche.responsable
            else "",



            # Financement
            marche.get_financement_display()
            if marche.financement
            else "",



            # OS commencement
            marche.date_demarrage_effective,



            # Dernier avancement
            date_dernier_avancement,



            # Avancements

            av_physique,

            av_temporel,

            av_financier,



            # Etat

            etat,



            # Retard

            retard,



            # Districts

            districts_text


        ])



    # ===============================
    # Mise en forme colonnes
    # ===============================

    for colonne in ws.columns:

        longueur = max(
            len(str(cell.value))
            if cell.value
            else 0
            for cell in colonne
        )

        ws.column_dimensions[
            get_column_letter(colonne[0].column)
        ].width = longueur + 5



    # Format date

    for row in ws.iter_rows():

        for cell in row:

            if cell.column in [8, 9] and cell.value:

                cell.number_format = "DD/MM/YYYY"



    # ===============================
    # Téléchargement
    # ===============================

    response = HttpResponse(
        content_type=
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


    response['Content-Disposition'] = (
        'attachment; filename="Suivi_Marches.xlsx"'
    )


    wb.save(response)


    return response