from travaux.management.commands.seed_axes import Command as SeedAxesCommand


class Command(SeedAxesCommand):
    help = "Alias pour l'injection des axes routiers dans la base de données"
