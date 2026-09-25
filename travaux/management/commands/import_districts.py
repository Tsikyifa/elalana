import csv
import os
from django.conf import settings
from django.core.management.base import BaseCommand
from travaux.models import Localisation

class Command(BaseCommand):
    help = 'Importation des 114 districts de Madagascar'

    def handle(self, *args, **options):
        path = os.path.join(settings.BASE_DIR, 'districts.csv')

        if not os.path.exists(path):
            self.stdout.write(self.style.ERROR(f"Erreur : Le fichier {path} est introuvable !"))
            return

        # Utilisation de utf-8-sig pour ignorer le BOM Excel s'il existe
        # Si vous avez toujours l'erreur 0x92, remplacez 'utf-8-sig' par 'cp1252'
        try:
            with open(path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                count = 0
                for row in reader:
                    if not row or len(row) < 3: 
                        continue
                    
                    # Nettoyage et création
                    obj, created = Localisation.objects.get_or_create(
                        province=row[0].strip().upper(),
                        region=row[1].strip().upper(),
                        district=row[2].strip()
                    )
                    if created:
                        count += 1
                
                self.stdout.write(self.style.SUCCESS(f"Succès ! {count} districts importés."))
        
        except UnicodeDecodeError:
            # Fallback si le fichier est vraiment encodé en format Windows
            self.stdout.write(self.style.WARNING("Échec UTF-8, tentative avec l'encodage Windows (cp1252)..."))
            self.import_with_encoding(path, 'cp1252')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Une erreur est survenue : {e}"))

    def import_with_encoding(self, path, enc):
        """Méthode de secours pour gérer les erreurs d'encodage"""
        with open(path, mode='r', encoding=enc) as f:
            #reader = csv.reader(f)
            reader = csv.reader(f, delimiter=';')
            count = 0
            for row in reader:
                if not row or len(row) < 3: continue
                obj, created = Localisation.objects.get_or_create(
                    province=row[0].strip().upper(),
                    region=row[1].strip().upper(),
                    district=row[2].strip()
                )
                if created: count += 1
            self.stdout.write(self.style.SUCCESS(f"Succès avec {enc} ! {count} districts importés."))