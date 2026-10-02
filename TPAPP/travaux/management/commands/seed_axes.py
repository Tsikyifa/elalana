import decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from travaux.models import Axe, Localisation, PKDistrict


AXES_DATA = [
    {
        "designation": "RN 1",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("220.000"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Tsiroanomandidy",
        "description": "Antananarivo - Analavory - Tsiroanomandidy. Axe stratégique de desserte de la région Bongolava et du Moyen-Ouest.",
        "segments": [
            {"pk_debut": 0.0, "deb": "Antananarivo", "pk_fin": 45.0, "fin": "Arivonimamo", "section": "Section 1", "longueur": 45.0},
            {"pk_debut": 45.0, "deb": "Arivonimamo", "pk_fin": 115.0, "fin": "Analavory", "section": "Section 2", "longueur": 70.0},
            {"pk_debut": 115.0, "deb": "Analavory", "pk_fin": 220.0, "fin": "Tsiroanomandidy", "section": "Section 3", "longueur": 105.0},
        ],
    },
    {
        "designation": "RN 2",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("367.000"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Toamasina I",
        "description": "Antananarivo - Moramanga - Brickaville - Toamasina. Corridor économique vital reliant la capitale au grand port maritime de Madagascar.",
        "segments": [
            {"pk_debut": 0.0, "deb": "Antananarivo", "pk_fin": 114.0, "fin": "Moramanga", "section": "Tronçon Tana-Moramanga", "longueur": 114.0},
            {"pk_debut": 114.0, "deb": "Moramanga", "pk_fin": 260.0, "fin": "Brickaville", "section": "Tronçon Moramanga-Brickaville", "longueur": 146.0},
            {"pk_debut": 260.0, "deb": "Brickaville", "pk_fin": 367.0, "fin": "Toamasina", "section": "Tronçon Brickaville-Toamasina", "longueur": 107.0},
        ],
    },
    {
        "designation": "RN 4",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("570.000"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Mahajanga I",
        "description": "Antananarivo - Ankazobe - Maevatanana - Ambondromamy - Mahajanga. Grande liaison routière vers la côte Nord-Ouest et le canal du Mozambique.",
        "segments": [
            {"pk_debut": 0.0, "deb": "Antananarivo", "pk_fin": 94.0, "fin": "Ankazobe", "section": "Tana - Ankazobe", "longueur": 94.0},
            {"pk_debut": 94.0, "deb": "Ankazobe", "pk_fin": 315.0, "fin": "Maevatanana", "section": "Ankazobe - Maevatanana", "longueur": 221.0},
            {"pk_debut": 315.0, "deb": "Maevatanana", "pk_fin": 412.0, "fin": "Ambondromamy", "section": "Maevatanana - Ambondromamy", "longueur": 97.0},
            {"pk_debut": 412.0, "deb": "Ambondromamy", "pk_fin": 570.0, "fin": "Mahajanga", "section": "Ambondromamy - Mahajanga", "longueur": 158.0},
        ],
    },
    {
        "designation": "RN 7",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("980.000"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Toliara I",
        "description": "Antananarivo - Antsirabe - Ambositra - Fianarantsoa - Ihosy - Toliara. Plus long corridor routier de Madagascar reliant les hautes terres au Grand Sud.",
        "segments": [
            {"pk_debut": 0.0, "deb": "Antananarivo", "pk_fin": 170.0, "fin": "Antsirabe", "section": "Tana - Antsirabe", "longueur": 170.0},
            {"pk_debut": 170.0, "deb": "Antsirabe", "pk_fin": 258.0, "fin": "Ambositra", "section": "Antsirabe - Ambositra", "longueur": 88.0},
            {"pk_debut": 258.0, "deb": "Ambositra", "pk_fin": 412.0, "fin": "Fianarantsoa", "section": "Ambositra - Fianarantsoa", "longueur": 154.0},
            {"pk_debut": 412.0, "deb": "Fianarantsoa", "pk_fin": 612.0, "fin": "Ihosy", "section": "Fianarantsoa - Ihosy", "longueur": 200.0},
            {"pk_debut": 612.0, "deb": "Ihosy", "pk_fin": 980.0, "fin": "Toliara", "section": "Ihosy - Toliara", "longueur": 368.0},
        ],
    },
    {
        "designation": "RN 43",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("133.000"),
        "depart_district": "Analavory",
        "fin_district": "Ambohibary",
        "description": "Analavory - Ampefy - Soavinandriana - Faratsiho - Sambaina (Ambohibary). Route du lac Itasy reliant la RN1 à la RN7.",
    },
    {
        "designation": "RN 44",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("228.000"),
        "depart_district": "Moramanga",
        "fin_district": "Ambatondrazaka",
        "description": "Moramanga - Ambatondrazaka - Imerimandroso - Amparafaravola. Grand grenier à riz de Madagascar (bassin d'Alaotra).",
    },
]


class Command(BaseCommand):
    help = "Seed les axes routiers majeurs de Madagascar dans la base de données"

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Supprime les axes existants avant de repeupler',
        )

    def find_district(self, name, region=None):
        if not name:
            return None

        district_name = str(name).strip()
        if not district_name:
            return None

        queryset = Localisation.objects.all()

        if region:
            region_name = str(region).strip()
            exact = queryset.filter(Q(district__iexact=district_name) & Q(region__iexact=region_name))
            if exact.exists():
                return exact.first()

            contains = queryset.filter(Q(district__icontains=district_name) & Q(region__iexact=region_name))
            if contains.exists():
                return contains.first()

        exact = queryset.filter(district__iexact=district_name)
        if exact.exists():
            return exact.first()

        contains = queryset.filter(district__icontains=district_name)
        if contains.exists():
            return contains.first()

        return None

    def validate_segments(self, axe_name, segments):
        validated = []
        ordered = sorted(
            segments,
            key=lambda seg: decimal.Decimal(str(seg["pk_debut"])),
        )

        for index, seg in enumerate(ordered, start=1):
            pk_debut = decimal.Decimal(str(seg["pk_debut"]))
            pk_fin = decimal.Decimal(str(seg["pk_fin"]))
            district_name = (seg.get("district") or "").strip()

            if pk_debut >= pk_fin:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{axe_name}] Segment #{index} invalide : PK début >= PK fin "
                        f"({pk_debut} >= {pk_fin}). Le segment est ignoré."
                    )
                )
                continue

            if not district_name:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{axe_name}] Segment #{index} sans district renseigné "
                        f"(PK {pk_debut} -> {pk_fin}). "
                        "Aucune attribution automatique n'est faite depuis dep_loc."
                    )
                )
                continue

            loc = self.find_district(district_name, region=seg.get("region"))
            if not loc:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{axe_name}] Segment #{index} : district '{district_name}' introuvable dans Localisation "
                        f"pour PK {pk_debut} -> {pk_fin}. Le segment est ignoré."
                    )
                )
                continue

            validated.append({
                "pk_debut": pk_debut,
                "pk_fin": pk_fin,
                "deb": seg.get("deb", ""),
                "fin": seg.get("fin", ""),
                "section": seg.get("section", ""),
                "longueur": decimal.Decimal(str(seg.get("longueur", abs(pk_fin - pk_debut)))),
                "district": loc,
            })

        for previous, current in zip(validated, validated[1:]):
            if previous["pk_fin"] > current["pk_debut"]:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{axe_name}] Chevauchement détecté entre les segments "
                        f"{previous['pk_debut']} -> {previous['pk_fin']} et "
                        f"{current['pk_debut']} -> {current['pk_fin']}."
                    )
                )

            if previous["pk_fin"] != current["pk_debut"]:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{axe_name}] Découpage PK non continu : "
                        f"{previous['pk_fin']} != {current['pk_debut']} entre les segments "
                        f"{previous['pk_debut']} -> {previous['pk_fin']} et {current['pk_debut']} -> {current['pk_fin']}."
                    )
                )

        return validated

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get('clear'):
            count_deleted, _ = Axe.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Suppression de {count_deleted} axe(s) existant(s)."))

        created_count = 0
        updated_count = 0

        for item in AXES_DATA:
            dep_loc = self.find_district(item.get("depart_district"))
            fin_loc = self.find_district(item.get("fin_district"))

            axe, created = Axe.objects.update_or_create(
                designation=item["designation"],
                defaults={
                    "type_axe": item.get("type_axe", "RN"),
                    "longueur_total": item.get("longueur_total", decimal.Decimal("0.000")),
                    "description": item.get("description", ""),
                    "pk_debut_district": dep_loc,
                    "pk_fin_district": fin_loc,
                },
            )

            segments = item.get("segments", [])
            if segments:
                validated_segments = self.validate_segments(axe.designation, segments)
                for seg in validated_segments:
                    PKDistrict.objects.update_or_create(
                        axe=axe,
                        pk_debut=seg["pk_debut"],
                        pk_fin=seg["pk_fin"],
                        defaults={
                            "deb": seg.get("deb", ""),
                            "fin": seg.get("fin", ""),
                            "section": seg.get("section", ""),
                            "longueur": seg["longueur"],
                            "district": seg["district"],
                        },
                    )

            if created:
                created_count += 1
            else:
                updated_count += 1

        total = Axe.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Opération terminée avec succès ! "
                f"{created_count} axe(s) créé(s), {updated_count} mis à jour. Total en base : {total}."
            )
        )
