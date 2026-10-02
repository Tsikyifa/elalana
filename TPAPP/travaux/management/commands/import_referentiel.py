import csv
import os
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.management.base import BaseCommand

from travaux.models import Axe, Localisation, PKDistrict


class Command(BaseCommand):
    help = "Importe le référentiel routier Madagascar : districts et segments PK × district."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear-pkdistrict",
            action="store_true",
            help="Supprime tous les PKDistrict avant l'import.",
        )
        parser.add_argument(
            "--clear-localisation",
            action="store_true",
            help="Supprime toutes les Localisation avant l'import.",
        )
        parser.add_argument(
            "--only-districts",
            action="store_true",
            help="N'exécute que l'import des districts (étape 1).",
        )
        parser.add_argument(
            "--only-pkdistricts",
            action="store_true",
            help="N'exécute que l'import des PKDistrict (étape 2).",
        )

    def write_banner(self):
        self.stdout.write(self.style.SUCCESS("========================================"))
        self.stdout.write(self.style.SUCCESS("IMPORT RÉFÉRENTIEL ROUTIER"))
        self.stdout.write(self.style.SUCCESS("========================================"))

    def clear_data(self, clear_pkdistrict=False, clear_localisation=False):
        if not clear_pkdistrict and not clear_localisation:
            return

        self.stdout.write(self.style.WARNING("[NETTOYAGE] Suppression des données demandée..."))

        if clear_pkdistrict or clear_localisation:
            PKDistrict.objects.all().delete()

        if clear_localisation:
            Localisation.objects.all().delete()

    def parse_decimal(self, value):
        try:
            return Decimal(str(value).strip())
        except (InvalidOperation, ValueError, TypeError):
            return None

    def import_districts(self):
        path = os.path.join(settings.BASE_DIR, "districts.csv")

        if not os.path.exists(path):
            self.stdout.write(self.style.ERROR(f"Fichier introuvable : {path}"))
            return {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

        self.stdout.write(self.style.SUCCESS("[ÉTAPE 1] Import des districts..."))
        treated = 0
        created = 0
        updated = 0
        ignored = 0

        try:
            with open(path, "r", encoding="utf-8-sig", newline="") as csv_file:
                reader = csv.reader(csv_file, delimiter=";")
                for row_number, row in enumerate(reader, start=1):
                    if row_number == 1:
                        continue
                    if not row or len(row) < 3:
                        ignored += 1
                        continue

                    province = (row[0] or "").strip()
                    region = (row[1] or "").strip()
                    district = (row[2] or "").strip()

                    if not province or not region or not district:
                        ignored += 1
                        continue

                    treated += 1
                    obj, created_flag = Localisation.objects.get_or_create(
                        province=province.upper(),
                        region=region.upper(),
                        district=district,
                    )

                    if created_flag:
                        created += 1
                    else:
                        updated += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"    → {created} créés, {updated} mis à jour, {ignored} ignorés ({treated} traités)"
                )
            )
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

        except UnicodeDecodeError:
            self.stdout.write(self.style.WARNING("    → Encodage UTF-8 raté, tentative avec cp1252..."))

        try:
            with open(path, "r", encoding="cp1252", newline="") as csv_file:
                reader = csv.reader(csv_file, delimiter=";")
                for row_number, row in enumerate(reader, start=1):
                    if row_number == 1:
                        continue
                    if not row or len(row) < 3:
                        ignored += 1
                        continue

                    province = (row[0] or "").strip()
                    region = (row[1] or "").strip()
                    district = (row[2] or "").strip()

                    if not province or not region or not district:
                        ignored += 1
                        continue

                    treated += 1
                    obj, created_flag = Localisation.objects.get_or_create(
                        province=province.upper(),
                        region=region.upper(),
                        district=district,
                    )

                    if created_flag:
                        created += 1
                    else:
                        updated += 1

            self.stdout.write(
                self.style.SUCCESS(
                    f"    → {created} créés, {updated} mis à jour, {ignored} ignorés ({treated} traités)"
                )
            )
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"Erreur lors de l'import des districts : {exc}"))
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

    def import_pkdistricts(self):
        path = os.path.join(settings.BASE_DIR, "data", "PK_DISTRICT_DATA.csv")

        if not os.path.exists(path):
            self.stdout.write(self.style.ERROR(f"Fichier introuvable : {path}"))
            return {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

        self.stdout.write(self.style.SUCCESS("[ÉTAPE 2] Import des PKDistrict..."))

        treated = 0
        created = 0
        updated = 0
        ignored = 0

        try:
            with open(path, "r", encoding="utf-8-sig", newline="") as csv_file:
                reader = csv.DictReader(csv_file, delimiter=",")
                required_fields = {"axe", "pk_debut", "pk_fin", "district", "region", "deb", "fin", "section"}
                if not reader.fieldnames:
                    self.stdout.write(self.style.ERROR("Le fichier PKDistrict est vide ou invalide."))
                    return {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

                missing_fields = sorted(required_fields - set(reader.fieldnames))
                if missing_fields:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Le fichier PKDistrict est incomplet. Champs manquants : {missing_fields}"
                        )
                    )
                    return {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

                for row_number, row in enumerate(reader, start=2):
                    treated += 1
                    axe_name = (row.get("axe") or "").strip()
                    district_name = (row.get("district") or "").strip()
                    region_name = (row.get("region") or "").strip()
                    deb = (row.get("deb") or "").strip()
                    fin = (row.get("fin") or "").strip()
                    section = (row.get("section") or "").strip()

                    if not axe_name:
                        self.stdout.write(self.style.WARNING(f"Ligne {row_number} : axe vide, ligne ignorée."))
                        ignored += 1
                        continue

                    axe = Axe.objects.filter(designation__iexact=axe_name).first()
                    if not axe:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Ligne {row_number} : axe '{axe_name}' introuvable. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    pk_debut = self.parse_decimal(row.get("pk_debut"))
                    pk_fin = self.parse_decimal(row.get("pk_fin"))
                    if pk_debut is None or pk_fin is None:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : valeurs PK invalides. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    if pk_debut >= pk_fin:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : pk_debut >= pk_fin ({pk_debut} >= {pk_fin}). Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    localisation = Localisation.objects.filter(
                        district__iexact=district_name,
                        region__iexact=region_name,
                    ).first()

                    if not localisation:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : district '{district_name}' / région '{region_name}' introuvable. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    longueur = pk_fin - pk_debut
                    # Use (axe, pk_debut) as lookup to respect DB unique constraint
                    obj, created_flag = PKDistrict.objects.update_or_create(
                        axe=axe,
                        pk_debut=pk_debut,
                        defaults={
                            "pk_fin": pk_fin,
                            "district": localisation,
                            "deb": deb,
                            "fin": fin,
                            "section": section,
                            "longueur": longueur,
                        },
                    )

                    if created_flag:
                        created += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"    → {axe_name} : PK {pk_debut} → {pk_fin} ({localisation.district}, {localisation.region}) [créé]"
                            )
                        )
                    else:
                        updated += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"    → {axe_name} : PK {pk_debut} → {pk_fin} ({localisation.district}, {localisation.region}) [mis à jour]"
                            )
                        )

            self.stdout.write(
                self.style.SUCCESS(
                    f"    → {created} créés, {updated} mis à jour, {ignored} ignorés ({treated} traités)"
                )
            )
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

        except UnicodeDecodeError:
            self.stdout.write(self.style.WARNING("    → Encodage UTF-8 raté, tentative avec cp1252..."))

        try:
            with open(path, "r", encoding="cp1252", newline="") as csv_file:
                reader = csv.DictReader(csv_file, delimiter=",")
                required_fields = {"axe", "pk_debut", "pk_fin", "district", "region", "deb", "fin", "section"}
                if missing_fields := sorted(required_fields - set(reader.fieldnames or [])):
                    self.stdout.write(
                        self.style.ERROR(
                            f"Le fichier PKDistrict est incomplet. Champs manquants : {missing_fields}"
                        )
                    )
                    return {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

                for row_number, row in enumerate(reader, start=2):
                    treated += 1
                    axe_name = (row.get("axe") or "").strip()
                    district_name = (row.get("district") or "").strip()
                    region_name = (row.get("region") or "").strip()
                    deb = (row.get("deb") or "").strip()
                    fin = (row.get("fin") or "").strip()
                    section = (row.get("section") or "").strip()

                    if not axe_name:
                        self.stdout.write(self.style.WARNING(f"Ligne {row_number} : axe vide, ligne ignorée."))
                        ignored += 1
                        continue

                    axe = Axe.objects.filter(designation__iexact=axe_name).first()
                    if not axe:
                        self.stdout.write(
                            self.style.WARNING(
                                f"Ligne {row_number} : axe '{axe_name}' introuvable. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    pk_debut = self.parse_decimal(row.get("pk_debut"))
                    pk_fin = self.parse_decimal(row.get("pk_fin"))
                    if pk_debut is None or pk_fin is None:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : valeurs PK invalides. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    if pk_debut >= pk_fin:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : pk_debut >= pk_fin ({pk_debut} >= {pk_fin}). Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    localisation = Localisation.objects.filter(
                        district__iexact=district_name,
                        region__iexact=region_name,
                    ).first()

                    if not localisation:
                        self.stdout.write(
                            self.style.WARNING(
                                f"[{axe_name}] Ligne {row_number} : district '{district_name}' / région '{region_name}' introuvable. Ligne ignorée."
                            )
                        )
                        ignored += 1
                        continue

                    longueur = pk_fin - pk_debut
                    # Use (axe, pk_debut) as lookup to respect DB unique constraint
                    obj, created_flag = PKDistrict.objects.update_or_create(
                        axe=axe,
                        pk_debut=pk_debut,
                        defaults={
                            "pk_fin": pk_fin,
                            "district": localisation,
                            "deb": deb,
                            "fin": fin,
                            "section": section,
                            "longueur": longueur,
                        },
                    )

                    if created_flag:
                        created += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"    → {axe_name} : PK {pk_debut} → {pk_fin} ({localisation.district}, {localisation.region}) [créé]"
                            )
                        )
                    else:
                        updated += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"    → {axe_name} : PK {pk_debut} → {pk_fin} ({localisation.district}, {localisation.region}) [mis à jour]"
                            )
                        )

            self.stdout.write(
                self.style.SUCCESS(
                    f"    → {created} créés, {updated} mis à jour, {ignored} ignorés ({treated} traités)"
                )
            )
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"Erreur lors de l'import des PKDistrict : {exc}"))
            return {"treated": treated, "created": created, "updated": updated, "ignored": ignored}

    def handle(self, *args, **options):
        self.write_banner()

        if options["only_districts"] and options["only_pkdistricts"]:
            self.stdout.write(self.style.ERROR("Les options --only-districts et --only-pkdistricts sont exclusives."))
            return

        self.clear_data(
            clear_pkdistrict=options["clear_pkdistrict"],
            clear_localisation=options["clear_localisation"],
        )

        district_result = {"treated": 0, "created": 0, "updated": 0, "ignored": 0}
        pk_result = {"treated": 0, "created": 0, "updated": 0, "ignored": 0}

        if options["only_districts"]:
            district_result = self.import_districts()
        elif options["only_pkdistricts"]:
            pk_result = self.import_pkdistricts()
        else:
            district_result = self.import_districts()
            pk_result = self.import_pkdistricts()

        self.stdout.write(self.style.SUCCESS("\n========================================"))
        self.stdout.write(self.style.SUCCESS("RÉSUMÉ FINAL"))
        self.stdout.write(self.style.SUCCESS("========================================"))
        self.stdout.write(
            self.style.SUCCESS(
                f"Districts        : {district_result['created']} créés, {district_result['updated']} mis à jour"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"PKDistrict       : {pk_result['created']} créés, {pk_result['updated']} mis à jour, {pk_result['ignored']} ignorés"
            )
        )
        self.stdout.write(self.style.SUCCESS("========================================"))
