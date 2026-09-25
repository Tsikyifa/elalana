from django.shortcuts import (
    render,
    redirect,
    get_object_or_404
)

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.contrib import messages
from django.db.models import Q

from .models import (
    DemandeAudience,
    ReportAudience,
    Historique,
    Direction
)

from .forms import (
    DemandeAudienceForm,
    ProgrammationAudienceForm
)

@login_required
def creer_demande(request):

    if request.method == "POST":

        form = DemandeAudienceForm(request.POST)

        if form.is_valid():

            demande = form.save(commit=False)

            demande.cree_par = request.user

            demande.save()

            Historique.objects.create(
                utilisateur=request.user,
                action="Création demande",
                objet=demande.numero
            )

            messages.success(
                request,
                f"Demande enregistrée. Référence : {demande.numero}"
            )

            return redirect(
                "detail_demande",
                pk=demande.pk
            )

    else:

        form = DemandeAudienceForm()

    return render(
        request,
        "audience/creer_demande.html",
        {
            "form": form
        }
    )


def _user_can_access_demande(user, demande):
    """Return True if `user` is allowed to access or modify `demande`."""
    if user.is_staff or user.is_superuser:
        return True
    # owner check
    if demande.cree_par == user:
        return True
    # fallback: deny
    return False
@login_required
def liste_demandes(request):

    q = request.GET.get('q')

    demandes = DemandeAudience.objects.all()

    if q:

        demandes = demandes.filter(
            Q(numero__icontains=q)
            | Q(nom_demandeur__icontains=q)
            | Q(telephone__icontains=q)
            | Q(organisme__icontains=q)
        )

    return render(
        request,
        "audience/liste_demandes.html",
        {
            "demandes": demandes,
            "q": q
        }
    )

@login_required
def detail_demande(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    historiques = Historique.objects.filter(
        objet=demande.numero
    ).order_by('-date_action')

    reports = demande.reports.all().order_by(
        '-date_report'
    )

    return render(
        request,
        "audience/detail_demande.html",
        {
            "demande": demande,
            "historiques": historiques,
            "reports": reports
        }
    )
@login_required
def programmer_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    if request.method == "POST":

        form = ProgrammationAudienceForm(
            request.POST,
            instance=demande
        )

        if form.is_valid():

            audience = form.save(commit=False)

            audience.statut = "PROGRAMME"

            audience.traite_par = request.user

            audience.save()

            Historique.objects.create(
                utilisateur=request.user,
                action="Audience programmée",
                objet=demande.numero
            )

            messages.success(
                request,
                "Audience programmée."
            )

            return redirect(
                "detail_demande",
                pk=demande.pk
            )

    else:

        form = ProgrammationAudienceForm(
            instance=demande
        )

    return render(
        request,
        "audience/programmer_audience.html",
        {
            "form": form,
            "demande": demande
        }
    )

@login_required
def accepter_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    demande.statut = "ACCEPTE"

    demande.traite_par = request.user

    demande.save()

    Historique.objects.create(
        utilisateur=request.user,
        action="Audience acceptée",
        objet=demande.numero
    )

    messages.success(
        request,
        "Audience acceptée."
    )

    return redirect(
        "detail_demande",
        pk=pk
    )

@login_required
def refuser_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    if request.method == "POST":

        motif = request.POST.get(
            "motif_refus"
        )

        demande.statut = "REFUSE"

        demande.motif_refus = motif

        demande.traite_par = request.user

        demande.save()

        Historique.objects.create(
            utilisateur=request.user,
            action="Audience refusée",
            objet=demande.numero
        )

        messages.success(
            request,
            "Audience refusée."
        )

        return redirect(
            "detail_demande",
            pk=pk
        )

    return render(
        request,
        "audience/refuser_audience.html",
        {
            "demande": demande
        }
    )

@login_required
def standby_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    if request.method == "POST":

        motif = request.POST.get(
            "motif_standby"
        )

        demande.statut = "STANDBY"

        demande.motif_standby = motif

        demande.traite_par = request.user

        demande.save()

        Historique.objects.create(
            utilisateur=request.user,
            action="Mise en Stand By",
            objet=demande.numero
        )

        return redirect(
            "detail_demande",
            pk=pk
        )

    return render(
        request,
        "audience/standby_audience.html",
        {
            "demande": demande
        }
    )

@login_required
def rediriger_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    directions = Direction.objects.all()

    if request.method == "POST":

        direction_id = request.POST.get(
            "direction"
        )

        motif = request.POST.get(
            "motif"
        )

        demande.direction_redirigee_id = direction_id

        demande.motif_redirection = motif

        demande.statut = "REDIRIGE"

        demande.traite_par = request.user

        demande.save()

        Historique.objects.create(
            utilisateur=request.user,
            action="Demande redirigée",
            objet=demande.numero
        )

        return redirect(
            "detail_demande",
            pk=pk
        )

    return render(
        request,
        "audience/rediriger_audience.html",
        {
            "demande": demande,
            "directions": directions
        }
    )

@login_required
def reporter_audience(request, pk):
    demande = get_object_or_404(
        DemandeAudience,
        pk=pk
    )
    if not _user_can_access_demande(request.user, demande):
        raise PermissionDenied("Accès refusé")

    if request.method == "POST":

        ancienne_date = demande.date_audience

        nouvelle_date = request.POST.get(
            "nouvelle_date"
        )

        motif = request.POST.get(
            "motif"
        )

        ReportAudience.objects.create(
            demande=demande,
            ancienne_date=ancienne_date,
            nouvelle_date=nouvelle_date,
            motif=motif,
            reporte_par=request.user
        )

        demande.date_audience = nouvelle_date

        demande.statut = "REPORTE"

        demande.traite_par = request.user

        demande.save()

        Historique.objects.create(
            utilisateur=request.user,
            action="Audience reportée",
            objet=demande.numero
        )

        return redirect(
            "detail_demande",
            pk=pk
        )

    return render(
        request,
        "audience/reporter_audience.html",
        {
            "demande": demande
        }
    )