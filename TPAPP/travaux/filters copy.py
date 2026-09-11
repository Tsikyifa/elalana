import django_filters
from django import forms
from .models import Marche, Localisation, Axe, Avancement


def get_titulaires_choices():
        titulaires = (
            Marche.objects
            .values_list('titulaire', flat=True)
            .distinct()
            .order_by('titulaire')
        )

        return [(t, t) for t in titulaires if t]
class MarcheReportingFilter(django_filters.FilterSet):
    num_marche = django_filters.CharFilter(
        lookup_expr='icontains', 
        label="N° Marché",
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: 01/2024...'})
    )

    type_axe = django_filters.ChoiceFilter(
        field_name='axe__type_axe',
        choices=Axe.TYPE_AXE,
        label="Type d'Axe",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    situation_w = django_filters.ChoiceFilter(
        field_name='avancements__situation_w',
        choices=Avancement.SITUATION_CHOICES,
        label="Situation Travaux",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    financement = django_filters.ChoiceFilter(
        choices=Marche.FINANCEMENT_CHOICES,
        label="Financement",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    SORTED_REGION_CHOICES = sorted(Localisation.REGION_CHOICES, key=lambda x: x[1])
    region = django_filters.ChoiceFilter(
        field_name='axe__segments_districts__district__region',
        choices=SORTED_REGION_CHOICES,
        label="Région",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    
    titulaire = django_filters.ChoiceFilter(
        field_name='titulaire',
        choices=get_titulaires_choices,
        label="Titulaire",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    axe = django_filters.ModelChoiceFilter(
        queryset=Axe.objects.all().order_by('designation'),
        label="Axe Routier",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    

    class Meta:
        model = Marche
        fields = ['num_marche', 'region', 'axe', 'type_axe', 'financement', 'situation_w','titulaire']

    