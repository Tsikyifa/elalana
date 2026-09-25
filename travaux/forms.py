from django import forms
from django.forms import inlineformset_factory, BaseInlineFormSet
from .models import Marche, PKMarche, Avancement, MediaAvancement, Axe, PKDistrict, OS, Bac, ConventionProgramme, TravauxGlisse
from django.core.exceptions import ValidationError
from .models import Localisation

class PKWidget(forms.MultiWidget):
    def __init__(self, attrs=None):
        widgets = [
            forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Km', 'style': 'width: 80px; text-align: right;'}),
            forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'm', 'style': 'width: 70px;', 'max': '999', 'min': '0'}),
        ]
        super().__init__(widgets, attrs)

    def decompress(self, value):
        if value is not None:
            # On sépare 12.345 en [12, 345]
            entier = int(value)
            decimal = int(round((value - entier) * 1000))
            return [entier, decimal]
        return [None, None]

    def value_from_datadict(self, data, files, name):
        vals = super().value_from_datadict(data, files, name)
        if vals[0] == "" or vals[0] is None:
            return None
        # On recompose le float : 12 + (345/1000) = 12.345
        return float(vals[0]) + (float(vals[1] or 0) / 1000)

    # Template pour afficher "Km + m"
    template_name = 'django/forms/widgets/multiwidget.html'

class PKField(forms.MultiValueField):
    widget = PKWidget
    def __init__(self, *args, **kwargs):
        fields = (
            forms.IntegerField(),
            forms.IntegerField(required=False),
        )
        super().__init__(fields, *args, **kwargs)

    def compress(self, data_list):
        if data_list:
            return float(data_list[0]) + (float(data_list[1] or 0) / 1000)
        return None
    
class OSForm(forms.ModelForm):
    class Meta:
        model = OS
        fields = ['type_os', 'date_os', 'delai_supplementaire','delai_unit','os_arret_concerne', 'commentaire','delai_jours_supplementaire']
        widgets = {
            'type_os': forms.Select(attrs={'class': 'form-select', 'onchange': 'toggleOSFields(this)'}),
            'date_os': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'delai_supplementaire': forms.NumberInput(attrs={'class': 'form-control'}),
            'delai_jours_supplementaire': forms.NumberInput(attrs={
                'class': 'form-control', 
                'placeholder': 'Jours suppl.'
            }), # 🔹 Nouveau widget
            'delai_unit': forms.Select(attrs={'class': 'form-select'}), # Nouveau
            'os_arret_concerne': forms.Select(attrs={'class': 'form-select'}),
            'commentaire': forms.Textarea(attrs={'rows': 2, 'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        marche = kwargs.pop('marche', None)
        super().__init__(*args, **kwargs)
        # On limite le choix des arrêts uniquement à ceux du marché concerné
        if marche:
            self.fields['os_arret_concerne'].queryset = OS.objects.filter(
                marche=marche, 
                type_os='ARRET'
            ).order_by('-date_os')

class MarcheForm(forms.ModelForm):
    detail_financement = forms.CharField(
        required=False, 
        widget=forms.TextInput(attrs={
            'class': 'form-control', 
            'placeholder': 'Detail Financement'
        })
    )
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        
        super().__init__(*args, **kwargs)
        self.fields['os_com'].required = False
        #On rend tout optionnel par défaut pour permettre le mode "Projet"
        for field in ['tiers','num_marche', 'montant', 'financement', 'titulaire', 'os_com', 'delai_nombre']:
            self.fields[field].required = False
        # 1. On récupère le queryset de base
        qs = Axe.objects.all()

        # 2. On applique le filtre selon l'utilisateur
        if user and not user.is_superuser:
            qs = qs.filter(attache_suivi=user)
        
        # 3. On applique l'ordre alphabétique à la fin
        # Remplacez 'nom' par le nom du champ dans votre modèle Axe
        self.fields['axe'].queryset = qs.order_by('type_axe','designation')
    class Meta:
        model = Marche
        fields = [
            'num_marche', 'resume', 'description', 'montant','financement','detail_financement', 'axe',
            'tiers', 'titulaire', 'responsable','os_com', 'delai_unit', 'delai_nombre','delai_jours','etape_actuelle','est_anticipe'
        ]
        widgets = {
            'axe': forms.Select(attrs={'class': 'form-select'}), # Ajout de l'axe
            'est_anticipe': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'etape_actuelle': forms.Select(attrs={'class': 'form-select', 'onchange': 'checkEtapePassation(this)'}),
            'num_marche': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: 123-M-2026'}),
            'resume': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Résumé court du marché'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Détails des travaux...'}),
            'montant': forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'Montant en Ariary'}),
            'financement': forms.Select(attrs={'class': 'form-select'}),
            'tiers': forms.TextInput(attrs={'class': 'form-control'}),
            'titulaire': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nom de l\'entreprise'}),
            'responsable': forms.Select(attrs={   # 👈 AJOUT ICI
                'class': 'form-select'
            }),
            # ... vos widgets existants ...
            'os_com': forms.DateInput(attrs={
                'type': 'date', 
                'class': 'form-control',
                'help_text': 'Note: La date d\'un OS de commencement écrasera cette valeur.'
            }),
            'delai_unit': forms.Select(attrs={'class': 'form-select'}),
            'delai_nombre': forms.NumberInput(attrs={'class': 'form-control', 'min': 1}),
            'delai_jours': forms.NumberInput(attrs={
                'class': 'form-control', 
                'min': 0, 
                'placeholder': 'Jours suppl.'
            }), #
        }
    def clean_delai_nombre(self):
        delai = self.cleaned_data.get('delai_nombre')
        if delai and delai <= 0:
            raise forms.ValidationError("Le délai doit être un nombre positif.")
        return delai
    def clean(self):
        cleaned_data = super().clean()
        # On ne fait rien, Django utilisera les paramètres blank/null du modèle
        return cleaned_data

class TravauxGlisseForm(forms.ModelForm):
    class Meta:
        model = TravauxGlisse
        fields = [
            'auc', 'date_auc', 'passation', 
            'annee_origine', 'annee_report', 
            'montant_reliquat', 'observation'
        ]
        widgets = {
            'auc': forms.Select(attrs={'class': 'form-select'}),
            'date_auc': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'passation': forms.Select(attrs={'class': 'form-select'}),
            'annee_origine': forms.NumberInput(attrs={'class': 'form-control'}),
            'annee_report': forms.NumberInput(attrs={'class': 'form-control'}),
            'montant_reliquat': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'observation': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }

# Formset pour lier TravauxGlisse à Marche
TravauxGlisseFormSet = inlineformset_factory(
    Marche, 
    TravauxGlisse, 
    form=TravauxGlisseForm,
    extra=0,       # Affiche un formulaire vide par défaut
    can_delete=True,
    #max_num=1      # Limite à un seul glissement par marché
)

class BasePKMarcheFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        if any(self.errors):
            return 

        segments_actifs = []

        for form in self.forms:
            if not form.cleaned_data or form.cleaned_data.get('DELETE'):
                continue
            
            pk_debut = form.cleaned_data.get('pk_debut')
            pk_fin = form.cleaned_data.get('pk_fin')

            if pk_debut is not None and pk_fin is not None:
                # 1. AUTORISER le ponctuel : pk_debut peut être égal à pk_fin
                # On ne lève une erreur que si le début est strictement supérieur à la fin
                if pk_debut > pk_fin:
                    form.add_error('pk_debut', "Le PK début ne peut pas être supérieur au PK fin.")
                    continue

                # 2. Vérification du chevauchement adaptée
                # Un point (10-10) est considéré en conflit s'il tombe à l'intérieur d'un segment existant
                for s_debut, s_fin in segments_actifs:
                    # Cas particulier pour les points ponctuels : 
                    # ils ne doivent pas être "strictement" à l'intérieur d'un autre segment
                    if pk_debut == pk_fin:
                        if s_debut <= pk_debut <= s_fin:
                            raise ValidationError(f"Le point PK {pk_debut} est déjà inclus dans le segment {s_debut}-{s_fin}.")
                    else:
                        # Validation standard pour les segments
                        if not (pk_fin <= s_debut or pk_debut >= s_fin):
                            raise ValidationError(
                                f"Chevauchement détecté : Le segment {pk_debut}-{pk_fin} "
                                f"entre en conflit avec {s_debut}-{s_fin}."
                            )
                
                segments_actifs.append((pk_debut, pk_fin))
                
# Création du Formset pour les PKMarche (Inlines)
PKMarcheFormSet = inlineformset_factory(
    Marche, 
    PKMarche, 
    formset=BasePKMarcheFormSet,
    fields=['pk_debut', 'pk_fin', 'description'],
    extra=1,             # Nombre de lignes vides par défaut
    can_delete=True,     # Permet de supprimer un tronçon
    widgets={
        'pk_debut': PKWidget(), # Utilisation du nouveau widget
        'pk_fin': PKWidget(),
        'description': forms.TextInput(attrs={'class': 'form-control'}),
    }
)

OSFormSet = inlineformset_factory(
    Marche, 
    OS, 
    form=OSForm, # On utilise notre classe personnalisée pour le filtrage os_arret_concerne
    extra=1,
    can_delete=True
)

class AvancementForm(forms.ModelForm):
    class Meta:
        model = Avancement
        fields = ['date_avancement', 'avancement_physique', 'avancement_financier', 'situation_w', 'detail_situation', 'observation']
        widgets = {
            'date_avancement': forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}),
            'avancement_physique': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '100', 'step': '0.01'}),
            'avancement_financier': forms.NumberInput(attrs={'class': 'form-control', 'min': '0', 'max': '100', 'step': '0.01'}),
            'situation_w': forms.Select(attrs={'class': 'form-select'}),
            'detail_situation': forms.Textarea(attrs={'rows': 3, 'class': 'form-control'}),
            'observation': forms.Textarea(attrs={'rows': 2, 'class': 'form-control'}),
        }

# Formset pour les photos/fichiers
MediaFormSet = forms.inlineformset_factory(
    Avancement, 
    MediaAvancement,
    fields=['fichier', 'legende'],
    extra=3, # Permet d'uploader 3 photos d'un coup
    can_delete=True,
    widgets={
        'fichier': forms.FileInput(attrs={'class': 'form-control', 'accept': 'image/*,application/pdf'}),
        'legende': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Description du média'}),
    }
)

class AxeForm(forms.ModelForm):
    class Meta:
        model = Axe
        fields = ['designation', 'type_axe', 'longueur_total', 'pk_debut_district', 'pk_fin_district', 'description']
        widgets = {
            'designation': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: RN7'}),
            'type_axe': forms.Select(attrs={'class': 'form-select'}),
            'longueur_total': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.001'}),
            'pk_debut_district': forms.Select(attrs={'class': 'form-select'}),
            'pk_fin_district': forms.Select(attrs={'class': 'form-select'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
        }

# Formset pour les segments de districts (Inlines)
PKDistrictFormSet = inlineformset_factory(
    Axe, 
    PKDistrict, 
    fields=['district', 'pk_debut', 'pk_fin'],
    extra=1,
    can_delete=True,
    widgets={
        'district': forms.Select(attrs={'class': 'form-select'}),
        'pk_debut': PKWidget(), # Utilisation du nouveau widget
        'pk_fin': PKWidget(), 
    }
)

class BacForm(forms.ModelForm):
    # PKField personnalisé (Km + m)
    pk_bac = forms.DecimalField(
        max_digits=10,
        decimal_places=3,
        widget=PKWidget(),
        label="PK Fin"
    )

    class Meta:
        model = Bac
        fields = '__all__' # Ou la liste spécifique vue précédemment
        widgets = {
            # On définit les classes Bootstrap pour tous les widgets
            'axe': forms.Select(attrs={'class': 'form-select'}),
            'region': forms.Select(attrs={'class': 'form-select'}),
            'localite': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Pont de la Sofia'}),
            'gestionnaire': forms.TextInput(attrs={'class': 'form-control'}),
            'chef_bac': forms.TextInput(attrs={'class': 'form-control'}),
            'riviere': forms.TextInput(attrs={'class': 'form-control'}),
            'constructeur': forms.TextInput(attrs={'class': 'form-control'}),
            'propulsion': forms.Select(attrs={'class': 'form-select'}),
            'employeur_passeur': forms.Select(attrs={'class': 'form-select'}),
            'etat_bac': forms.Select(attrs={'class': 'form-select'}),
            'etat_financement_bac': forms.Select(attrs={'class': 'form-select'}),
            
            # Champs numériques
            'longitude': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'latitude': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'portance': forms.NumberInput(attrs={'class': 'form-control', 'min': '0'}),
            'nbr_capacite': forms.NumberInput(attrs={'class': 'form-control', 'min': '0'}),
            'besoin_entretien_bac': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            
            # TextAreas (Champs longs)
            'detail_etat_bac': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'observation': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'projet_en_cours': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            'projet_en_perspective': forms.Textarea(attrs={'class': 'form-control', 'rows': 2}),
            
            'image': forms.FileInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # 1. Tri alphabétique des régions (votre demande précédente)
        raw_regions = list(Localisation.REGION_CHOICES)
        self.fields['region'].choices = sorted(raw_regions, key=lambda x: x[1])

        # 2. AUTOMATISATION DU RESPECT DE BLANK=TRUE / NULL=TRUE
        # On parcourt tous les champs du modèle lié
        for field_name, field in self.fields.items():
            # On vérifie si le champ dans le modèle est optionnel (blank=True)
            # Note: pk_bac n'est pas dans model._meta car c'est un champ déclaré manuellement
            if field_name in self.instance._meta._forward_fields_map:
                model_field = self.instance._meta.get_field(field_name)
                if model_field.blank or model_field.null:
                    field.required = False
                    # Optionnel: Ajouter une classe visuelle ou un placeholder "Optionnel"
                    existing_class = field.widget.attrs.get('class', '')
                    field.widget.attrs['placeholder'] = "(Facultatif)" if not field.widget.attrs.get('placeholder') else field.widget.attrs.get('placeholder')

class CPForm(forms.ModelForm):
    # DÉCLARATION EXPLICITE : Indispensable pour que PKField/PKWidget fonctionne
    pk_debut = forms.DecimalField(
        max_digits=10,
        decimal_places=3,
        widget=PKWidget(),
        label="PK Début"
    )

    pk_fin = forms.DecimalField(
        max_digits=10,
        decimal_places=3,
        widget=PKWidget(),
        label="PK Fin"
    )

    class Meta:
        model = ConventionProgramme
        fields = [
            'axe', 'annee', 'region', 'section',
            'pk_debut', 'localite_deb', 
            'pk_fin', 'localite_fin',
            'longueur_traite', 'nature_surface',
            'montant_minima', 'montant_souhaite'
        ]
        widgets = {
            'axe': forms.Select(attrs={'class': 'form-select'}),
            'annee': forms.NumberInput(attrs={'class': 'form-control'}),
            'region': forms.Select(attrs={'class': 'form-select'}),
            'section': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nom de la section'}),
            'localite_deb': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Localité de début'}),
            'localite_fin': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Localité de fin'}),
            'nature_surface': forms.Select(attrs={'class': 'form-select'}),
            'longueur_traite': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.001'}),
            'montant_minima': forms.NumberInput(attrs={'class': 'form-control'}),
            'montant_souhaite': forms.NumberInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['axe'].queryset = Axe.objects.all().order_by('designation')
        self.fields['region'].choices = Localisation.REGION_CHOICES
        # Optionnel : Rendre certains champs non-obligatoires si besoin
        self.fields['montant_minima'].required = False
        self.fields['montant_souhaite'].required = False

    def clean(self):
        cleaned_data = super().clean()
        pk_debut = cleaned_data.get('pk_debut')
        pk_fin = cleaned_data.get('pk_fin')

        if pk_debut is not None and pk_fin is not None:
            if pk_debut >= pk_fin:
                raise ValidationError("PK début doit être inférieur au PK fin.")

        return cleaned_data