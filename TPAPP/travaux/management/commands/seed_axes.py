import decimal
from django.core.management.base import BaseCommand
from django.db import transaction
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
        "designation": "RN 1b",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("310.000"),
        "depart_district": "Analavory",
        "fin_district": "Maintirano",
        "description": "Analavory - Tsiroanomandidy - Maintirano. Liaison vers la région Melaky sur la côte Ouest.",
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
        "designation": "RN 3",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("91.000"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Anjozorobe",
        "description": "Antananarivo - Sabotsy Namehana - Talata Volonondry - Anjozorobe. Axe de la route du Nord-Est dans l'Analamanga.",
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
        "designation": "RN 5",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("395.000"),
        "depart_district": "Toamasina I",
        "fin_district": "Maroantsetra",
        "description": "Toamasina - Fénérive Est - Soanierana Ivongo - Mananara Nord - Maroantsetra. Route du littoral Nord-Est.",
    },
    {
        "designation": "RN 5a",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("406.000"),
        "depart_district": "Ambilobe",
        "fin_district": "Antalaha",
        "description": "Ambilobe - Vohémar - Sambava - Antalaha. Axe stratégique de la région SAVA et de la vanille.",
    },
    {
        "designation": "RN 6",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("706.000"),
        "depart_district": "Ambondromamy",
        "fin_district": "Antsiranana I",
        "description": "Ambondromamy - Port-Bergé - Antsohihy - Ambanja - Ambilobe - Antsiranana (Diégo-Suarez). Grand axe du Nord malgache.",
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
        "designation": "RN 8",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("198.000"),
        "depart_district": "Morondava",
        "fin_district": "Belo-sur-Tsiribihina",
        "description": "Morondava - Allée des Baobabs - Belo-sur-Tsiribihina - Bekopaka (Tsingy de Bemaraha).",
    },
    {
        "designation": "RN 9",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("350.000"),
        "depart_district": "Toliara I",
        "fin_district": "Morombe",
        "description": "Toliara - Analamisampy - Manja - Morombe. Corridor Sud-Ouest le long du canal de Mozambique.",
    },
    {
        "designation": "RN 10",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("412.000"),
        "depart_district": "Andranovory",
        "fin_district": "Ambovombe",
        "description": "Andranovory - Betioky Sud - Ampanihy - Beloha - Ambovombe. Grande transversale du Sud profond de Madagascar.",
    },
    {
        "designation": "RN 11",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("204.000"),
        "depart_district": "Mananjary",
        "fin_district": "Mahanoro",
        "description": "Mananjary - Nosy Varika - Mahanoro. Desserte littorale de la côte Est le long du Canal des Pangalanes.",
    },
    {
        "designation": "RN 11a",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("150.000"),
        "depart_district": "Vatomandry",
        "fin_district": "Mahanoro",
        "description": "Antatsimo - Vatomandry - Ilaka Est - Mahanoro.",
    },
    {
        "designation": "RN 12",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("295.000"),
        "depart_district": "Irondro",
        "fin_district": "Farafangana",
        "description": "Irondro - Manakara - Vohipeno - Farafangana. Axe principal de la côte Sud-Est (Fitovinany et Atsimo-Atsinanana).",
    },
    {
        "designation": "RN 12a",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("335.000"),
        "depart_district": "Farafangana",
        "fin_district": "Taolagnaro",
        "description": "Farafangana - Vangaindrano - Manantenina - Taolagnaro (Fort-Dauphin). Desserte côtière Sud-Est et Anosy.",
    },
    {
        "designation": "RN 13",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("493.000"),
        "depart_district": "Ihosy",
        "fin_district": "Taolagnaro",
        "description": "Ihosy - Betroka - Beraketa - Ambovombe - Amboasary - Taolagnaro. Axe intérieur d'accès au grand Sud et à l'Anosy.",
    },
    {
        "designation": "RN 25",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("161.000"),
        "depart_district": "Fianarantsoa I",
        "fin_district": "Mananjary",
        "description": "Ambohimahasoa - Ranomafana - Ifanadiana - Mananjary. Liaison entre les Hautes Terres et la mer à l'Est.",
    },
    {
        "designation": "RN 27",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("270.000"),
        "depart_district": "Ihosy",
        "fin_district": "Farafangana",
        "description": "Ihosy - Ivohibe - Farafangana. Route transversale reliant le plateau d'Ihorombe au littoral Sud-Est.",
    },
    {
        "designation": "RN 31",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("135.000"),
        "depart_district": "Antsohihy",
        "fin_district": "Bealanana",
        "description": "Antsohihy - Bealanana. Desserte de la cuvette rizicole de Bealanana dans la Sofia.",
    },
    {
        "designation": "RN 32",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("200.000"),
        "depart_district": "Antsohihy",
        "fin_district": "Mandritsara",
        "description": "Antsohihy - Mandritsara. Liaison importante du nord-ouest vers l'intérieur de la Sofia.",
    },
    {
        "designation": "RN 34",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("368.000"),
        "depart_district": "Antsirabe I",
        "fin_district": "Malaimbandy",
        "description": "Antsirabe - Betafo - Mandoto - Miandrivazo - Malaimbandy. Porte d'entrée du Menabe depuis les hautes terres.",
    },
    {
        "designation": "RN 35",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("460.000"),
        "depart_district": "Ambositra",
        "fin_district": "Morondava",
        "description": "Ambositra - Ambatofinandrahana - Malaimbandy - Ankilizato - Morondava. Traversée des massifs centraux vers la côte du Menabe.",
    },
    {
        "designation": "RN 41",
        "type_axe": "RN",
        "longueur_total": decimal.Decimal("41.000"),
        "depart_district": "Ambositra",
        "fin_district": "Fandriana",
        "description": "Ambositra - Fandriana. Desserte agricole et artisanale dans l'Amoron'i Mania.",
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
    {
        "designation": "Rocade d'Iarivo",
        "type_axe": "AU",
        "longueur_total": decimal.Decimal("12.500"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Antananarivo-Avaradrano",
        "description": "Boulevard de Tokyo et Rocade Est d'Antananarivo. Contournement urbain stratégique de l'agglomération.",
    },
    {
        "designation": "Fly-Over Anosizato",
        "type_axe": "FL",
        "longueur_total": decimal.Decimal("3.200"),
        "depart_district": "Antananarivo-Renivohitra",
        "fin_district": "Antananarivo-Atsimondrano",
        "description": "Voie rapide et échangeur dénivelé d'Anosizato pour la fluidification du trafic sud.",
    },
    {
        "designation": "Pont Kamoro",
        "type_axe": "PT",
        "longueur_total": decimal.Decimal("0.280"),
        "depart_district": "Maevatanana",
        "fin_district": "Maevatanana",
        "description": "Pont suspendu historique sur la rivière Kamoro (RN 4, PK 406+300), ouvrage d'art majeur réhabilité.",
    },
    {
        "designation": "Pont Betsiboka",
        "type_axe": "PT",
        "longueur_total": decimal.Decimal("0.350"),
        "depart_district": "Maevatanana",
        "fin_district": "Maevatanana",
        "description": "Pont métallique historique sur le fleuve Betsiboka (RN 4, PK 336+000).",
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

    def find_district(self, name):
        if not name:
            return None
        # Recherche par district exact ou insensible à la casse
        loc = Localisation.objects.filter(district__iexact=name).first()
        if not loc:
            loc = Localisation.objects.filter(district__icontains=name).first()
        return loc

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

            # Optionnel : segments PK
            segments = item.get("segments", [])
            if segments:
                for seg in segments:
                    PKDistrict.objects.update_or_create(
                        axe=axe,
                        pk_debut=decimal.Decimal(str(seg["pk_debut"])),
                        pk_fin=decimal.Decimal(str(seg["pk_fin"])),
                        defaults={
                            "deb": seg.get("deb", ""),
                            "fin": seg.get("fin", ""),
                            "section": seg.get("section", ""),
                            "longueur": decimal.Decimal(str(seg.get("longueur", 0))),
                            "district": dep_loc,
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
