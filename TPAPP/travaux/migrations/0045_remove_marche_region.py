from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('travaux', '0044_messagemarche_fichier_alter_messagemarche_contenu'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='marche',
            name='region',
        ),
    ]
