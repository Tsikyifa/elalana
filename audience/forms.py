from django import forms
from .models import DemandeAudience


class DemandeAudienceForm(forms.ModelForm):

    class Meta:
        model = DemandeAudience

        fields = [
            'nom_demandeur',
            'organisme',
            'fonction',
            'telephone',
            'email',
            'adresse',
            'objet',
            'date_souhaitee',
            'heure_souhaitee',
        ]

        widgets = {

            'nom_demandeur': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'Nom et prénom du demandeur'
                }
            ),

            'organisme': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'Entreprise, association, ministère...'
                }
            ),

            'fonction': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'Fonction du demandeur'
                }
            ),

            'telephone': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': '034 XX XXX XX'
                }
            ),

            'email': forms.EmailInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'adresse@email.com'
                }
            ),

            'adresse': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 2,
                    'placeholder': 'Adresse du demandeur'
                }
            ),

            'objet': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 4,
                    'placeholder': "Objet de la demande d'audience"
                }
            ),

            'date_souhaitee': forms.DateInput(
                attrs={
                    'type': 'date',
                    'class': 'form-control'
                }
            ),

            'heure_souhaitee': forms.TimeInput(
                attrs={
                    'type': 'time',
                    'class': 'form-control'
                }
            ),
        }

        labels = {
            'nom_demandeur': 'Nom du demandeur',
            'organisme': 'Organisme',
            'fonction': 'Fonction',
            'telephone': 'Téléphone',
            'email': 'Email',
            'adresse': 'Adresse',
            'objet': 'Objet',
            'date_souhaitee': 'Date souhaitée',
            'heure_souhaitee': 'Heure souhaitée',
        }

    def clean_telephone(self):
        telephone = self.cleaned_data.get('telephone')

        if len(telephone.strip()) < 10:
            raise forms.ValidationError(
                "Numéro de téléphone invalide."
            )

        return telephone
    
class ProgrammationAudienceForm(forms.ModelForm):

    class Meta:
        model = DemandeAudience

        fields = [
            'date_audience',
            'date_fin_audience',
            'observation_audience'
        ]

        widgets = {

            'date_audience': forms.DateTimeInput(
                attrs={
                    'type': 'datetime-local',
                    'class': 'form-control'
                }
            ),

            'date_fin_audience': forms.DateTimeInput(
                attrs={
                    'type': 'datetime-local',
                    'class': 'form-control'
                }
            ),

            'observation_audience': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 3
                }
            ),
        }