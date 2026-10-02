from django.contrib.auth.models import User, Group
from django.test import TestCase

from apitp.serializers import MarcheWriteSerializer
from travaux.mixins import user_can_access_marche, filter_queryset_for_user, is_project_manager_user
from travaux.models import Axe, Marche


class ProjectManagerAccessTests(TestCase):
    def setUp(self):
        self.manager = User.objects.create_user(username='chef', password='secret')
        self.other_user = User.objects.create_user(username='autre', password='secret')
        self.axe = Axe.objects.create(
            designation='RN2',
            type_axe='RN',
            attache_suivi=self.manager,
        )
        self.other_axe = Axe.objects.create(
            designation='RN3',
            type_axe='RN',
            attache_suivi=self.other_user,
        )
        self.marche = Marche.objects.create(
            axe=self.axe,
            description='Travaux principal',
            resume='RN2 - Test',
            financement='RPI',
            tiers='Tiers A',
            titulaire='Titulaire A',
            etape_actuelle='EXE',
        )
        self.other_marche = Marche.objects.create(
            axe=self.other_axe,
            description='Autre marché',
            resume='RN3 - Test',
            financement='RPI',
            tiers='Tiers B',
            titulaire='Titulaire B',
            etape_actuelle='EXE',
        )

    def test_manager_can_access_only_assigned_marche(self):
        self.assertTrue(user_can_access_marche(self.manager, self.marche))
        self.assertFalse(user_can_access_marche(self.manager, self.other_marche))

    def test_queryset_is_limited_to_user_assignment(self):
        qs = filter_queryset_for_user(self.manager, Marche.objects.all())
        self.assertEqual(set(qs.values_list('pk', flat=True)), {self.marche.pk})

    def test_group_membership_does_not_override_assignment(self):
        group = Group.objects.create(name='chef_axe')
        self.manager.groups.add(group)

        self.assertTrue(user_can_access_marche(self.manager, self.marche))
        self.assertFalse(user_can_access_marche(self.manager, self.other_marche))

    def test_project_manager_group_is_recognized_for_scope_control(self):
        group = Group.objects.create(name='chef_de_projet')
        self.manager.groups.add(group)

        self.assertTrue(is_project_manager_user(self.manager))
        self.assertTrue(user_can_access_marche(self.manager, self.marche))
        self.assertFalse(user_can_access_marche(self.manager, self.other_marche))

    def test_minister_role_has_global_read_access(self):
        minister = User.objects.create_user(username='ministere', password='secret')
        minister_group = Group.objects.create(name='ministre')
        minister.groups.add(minister_group)

        self.assertTrue(user_can_access_marche(minister, self.marche))
        self.assertTrue(user_can_access_marche(minister, self.other_marche))

        qs = filter_queryset_for_user(minister, Marche.objects.all())
        self.assertEqual(set(qs.values_list('pk', flat=True)), {self.marche.pk, self.other_marche.pk})

    def test_admin_can_assign_project_manager_while_creating_marche(self):
        admin = User.objects.create_user(username='admin', password='secret')
        admin_group = Group.objects.create(name='admin')
        admin.groups.add(admin_group)

        pm = User.objects.create_user(username='pm_assigned', password='secret')
        pm_group = Group.objects.create(name='chef_de_projet')
        pm.groups.add(pm_group)

        axe = Axe.objects.create(
            designation='RN4',
            type_axe='RN',
            attache_suivi=self.other_user,
        )

        payload = {
            'axe': str(axe.pk),
            'resume': 'RN4 - Marché assigné',
            'description': 'Description du marché',
            'financement': 'RPI',
            'tiers': 'Tiers C',
            'titulaire': 'Titulaire C',
            'etape_actuelle': 'EXE',
            'chef_de_projet': pm.pk,
        }

        serializer = MarcheWriteSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        marche = serializer.save()

        self.assertEqual(marche.axe.attache_suivi, pm)
        self.assertEqual(axe.attache_suivi, pm)
