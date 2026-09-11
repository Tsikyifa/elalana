import django_filters
from django import forms
from .models import Marche, Localisation, Axe, Avancement


def get_titulaires_choices():
    # On récupère tout
    raw_titulaires = Marche.objects.values_list('titulaire', flat=True).distinct()
    
    # On nettoie : on enlève les espaces et on met tout en majuscules pour filtrer les doublons
    cleaned = set()
    for t in raw_titulaires:
        if t:
            cleaned.add(t.strip().upper()) # "colas" et "Colas " deviennent "COLAS"
            
    # On remet en liste triée pour le select
    return sorted([(t, t) for t in cleaned])

class MarcheReportingFilter(django_filters.FilterSet):

    num_marche = django_filters.CharFilter(
        lookup_expr='icontains',
        label="N° Marché",
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ex: 01/2024...'
        })
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
        widget=forms.Select(attrs={'class': 'form-select'}),
        distinct=True   # 🔥 IMPORTANT
    )

    financement = django_filters.ChoiceFilter(
        field_name='financement',
        choices=Marche.FINANCEMENT_CHOICES,
        label="Financement",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    SORTED_REGION_CHOICES = sorted(
        Localisation.REGION_CHOICES,
        key=lambda x: x[1]
    )

    region = django_filters.ChoiceFilter(
        field_name='axe__segments_districts__district__region',
        choices=SORTED_REGION_CHOICES,
        label="Région",
        widget=forms.Select(attrs={'class': 'form-select'}),
        distinct=True   # 🔥 IMPORTANT
    )

    en_retard = django_filters.ChoiceFilter(
        label="Alerte Retard",
        method='filter_retard',
        choices=[(True, 'En retard'), (False, 'En phase')],
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    titulaire = django_filters.ChoiceFilter(
    field_name='titulaire',
    lookup_expr='icontains', # 🔥 Trouvera "Colas" même si on cherche "COLAS"
    choices=get_titulaires_choices,
    label="Titulaire",
    widget=forms.Select(attrs={'class': 'form-select'})
)

    axe = django_filters.ModelChoiceFilter(
        queryset=Axe.objects.all().order_by('designation'),
        label="Axe Routier",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    def filter_retard(self, queryset, name, value):
        if not value:
            return queryset
            
        # On filtre les marchés en fonction de votre @property Python
        # Attention : filter() sur une propriété calculée demande de passer par les IDs
        all_marches = queryset.prefetch_related('avancements')
        
        if value == 'True':
            ids = [m.id for m in all_marches if any(av.est_en_retard for av in m.avancements.all()[:1])]
            return queryset.filter(id__in=ids)
        elif value == 'False':
            ids = [m.id for m in all_marches if not any(av.est_en_retard for av in m.avancements.all()[:1])]
            return queryset.filter(id__in=ids)
            
        return queryset

    class Meta:
        model = Marche
        fields = [
            'num_marche',
            'region',
            'axe',
            'type_axe',
            'financement',
            'situation_w',
            'titulaire',
            'en_retard'
        ]