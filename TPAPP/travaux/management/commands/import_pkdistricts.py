import csv
import os
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.conf import settings

from travaux.models import Axe, Localisation, PKDistrict


class Command(BaseCommand):
    help = "Importe les segments PK × district depuis data/PK_DISTRICT_DATA.csv vers le modèle PKDistrict."

    def add_arguments(self, parser):
        parser.add_argument(
            "--csv",
            dest="csv_path",
            default=None,
            help="Chemin du CSV à importer (par défaut : data/PK_DISTRICT_DATA.csv)",
        )

    def find_axe(self, designation):
        if designation is None:
            return None
        return Axe.objects.filter(designation__iexact=str(designation).strip()).first()

    def find_localisation(self, district_name, region_name):
        district = (district_name or "").strip()
        region = (region_name or "").strip()

        if not district:
            return None

        queryset = Localisation.objects.all()

        if region:
            exact = queryset.filter(Q(district__iexact=district) & Q(region__iexact=region))
            if exact.exists():
                return exact.first()

            contains = queryset.filter(Q(district__icontains=district) & Q(region__iexact=region))
            if contains.exists():
                return contains.first()

        exact = queryset.filter(district__iexact=district)
        if exact.exists():
            return exact.first()

        contains = queryset.filter(district__icontains=district)
        if contains.exists():
            return contains.first()

        return None

    def parse_decimal(self, value, field_name, row_number, axe_name):
        try:
            return Decimal(str(value).strip())
        except (InvalidOperation, ValueError, TypeError):
            self.stdout.write(
                self.style.ERROR(
                    f"[{axe_name}] Ligne {row_number} : valeur invalide pour {field_name} = {value!r}. "
                    "La ligne est ignorée."
                )
            )
            return None

    @transaction.atomic
    def handle(self, *args, **options):
        csv_path = options.get("csv_path") or os.path.join(settings.BASE_DIR, "data", "PK_DISTRICT_DATA.csv")
        csv_path = os.path.normpath(csv_path)

        if not os.path.exists(csv_path):
            self.stdout.write(
                self.style.ERROR(f"Fichier CSV introuvable : {csv_path}")
            )
            return

        treated_count = 0
        created_count = 0
        updated_count = 0
        ignored_count = 0

        with open(csv_path, "r", encoding="utf-8", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            required_fields = {"axe", "pk_debut", "pk_fin", "district", "region", "deb", "fin", "section"}
            missing_fields = required_fields - set(reader.fieldnames or [])
            if missing_fields:
                self.stdout.write(
                    self.style.ERROR(
                        f"Le fichier CSV est incomplet. Champs manquants : {sorted(missing_fields)}"
                    )
                )
                return

            for row_number, row in enumerate(reader, start=2):
                treated_count += 1
                axe_name = (row.get("axe") or "").strip()
                district_name = (row.get("district") or "").strip()
                region_name = (row.get("region") or "").strip()
                deb = (row.get("deb") or "").strip()
                fin = (row.get("fin") or "").strip()
                section = (row.get("section") or "").strip()

                if not axe_name:
                    self.stdout.write(
                        self.style.WARNING(
                            f"Ligne {row_number} : axe vide. Ligne ignorée."
                        )
                    )
                    ignored_count += 1
                    continue

                axe = self.find_axe(axe_name)
                if not axe:
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{axe_name}] Ligne {row_number} : axe non trouvé dans la base. Ligne ignorée."
                        )
                    )
                    ignored_count += 1
                    continue

                pk_debut = self.parse_decimal(row.get("pk_debut"), "pk_debut", row_number, axe_name)
                pk_fin = self.parse_decimal(row.get("pk_fin"), "pk_fin", row_number, axe_name)

                if pk_debut is None or pk_fin is None:
                    ignored_count += 1
                    continue

                if pk_debut >= pk_fin:
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{axe_name}] Ligne {row_number} : pk_debut >= pk_fin "
                            f"({pk_debut} >= {pk_fin}). Ligne ignorée."
                        )
                    )
                    ignored_count += 1
                    continue

                local = self.find_localisation(district_name, region_name)
                if not local:
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{axe_name}] Ligne {row_number} : district '{district_name}' "
                            f"et région '{region_name}' introuvables dans Localisation. Ligne ignorée."
                        )
                    )
                    ignored_count += 1
                    continue

                longueur = pk_fin - pk_debut
                if longueur <= 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{axe_name}] Ligne {row_number} : longueur invalide ({longueur}). Ligne ignorée."
                        )
                    )
                    ignored_count += 1
                    continue

                obj, created = PKDistrict.objects.update_or_create(
                    axe=axe,
                    pk_debut=pk_debut,
                    pk_fin=pk_fin,
                    defaults={
                        "district": local,
                        "deb": deb,
                        "fin": fin,
                        "section": section,
                        "longueur": longueur,
                    },
                )

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[{axe_name}] Ligne {row_number} : créa PKDistrict {pk_debut} -> {pk_fin} "
                            f"({local.district}, {local.region})"
                        )
                    )
                else:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"[{axe_name}] Ligne {row_number} : mise à jour PKDistrict {pk_debut} -> {pk_fin} "
                            f"({local.district}, {local.region})"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Import PKDistrict terminé. Traitées : {treated_count}, créés : {created_count}, "
                f"mis à jour : {updated_count}, ignorées : {ignored_count}."
            )
        )
