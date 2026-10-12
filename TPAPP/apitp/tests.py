import json

from django.test import Client, SimpleTestCase, TestCase
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from shapely.geometry import LineString
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from TPAPP.asgi import application
from apitp.geo_utils import designation_to_geojson_path, designation_to_ref, extract_segment_between_pk
from apitp.views import get_auth_cookie_config, _matches_dashboard_period
from apitp.serializers import MarcheWriteSerializer
from travaux.models import Axe, Bac, Marche, Avancement, MediaAvancement, Notification, ConventionProgramme


class AuthCookieConfigTests(TestCase):
    def test_production_cookie_uses_shared_domain(self):
        config = get_auth_cookie_config('back.elalana.mg', is_production=True)
        self.assertEqual(config['domain'], '.elalana.mg')
        self.assertTrue(config['secure'])
        self.assertEqual(config['samesite'], 'None')

    def test_localhost_cookie_avoids_shared_domain(self):
        config = get_auth_cookie_config('localhost:5173', is_production=False)
        self.assertIsNone(config['domain'])
        self.assertFalse(config['secure'])
        self.assertEqual(config['samesite'], 'Lax')

    def test_logout_expire_all_auth_cookies(self):
        client = Client()
        client.cookies['access'] = 'token-abc'
        client.cookies['refresh'] = 'refresh-abc'
        client.cookies['sessionid'] = 'session-abc'
        client.cookies['csrftoken'] = 'csrf-abc'

        response = client.post('/api/auth/logout/')

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.cookies)
        self.assertIn('refresh', response.cookies)
        self.assertIn('sessionid', response.cookies)
        self.assertIn('csrftoken', response.cookies)
        self.assertEqual(response.cookies['access']['max-age'], 0)
        self.assertEqual(response.cookies['refresh']['max-age'], 0)
        self.assertEqual(response.cookies['sessionid']['max-age'], 0)
        self.assertEqual(response.cookies['csrftoken']['max-age'], 0)

    def test_logout_deletes_user_tokens(self):
        User = get_user_model()
        user = User.objects.create_user(username='logout-user', password='secret123')
        token = Token.objects.create(user=user)

        client = Client()
        client.cookies['access'] = token.key

        response = client.post('/api/auth/logout/')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(Token.objects.filter(user=user).exists())


class MarcheSerializerTests(TestCase):
    def test_update_accepts_axe_designation_instead_of_uuid(self):
        axe = Axe.objects.create(designation='RN1', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux ancien',
            resume='Travaux ancien',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        serializer = MarcheWriteSerializer(
            instance=marche,
            data={'axe': 'RN1', 'resume': 'Nouveau résumé', 'description': 'Nouveau libellé'},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['axe'], axe)


class AvancementAttachmentTests(TestCase):
    def test_create_avancement_accepts_fichier_and_legende_fields(self):
        user = get_user_model().objects.create_user(username='av-upload', password='secret123')
        axe = Axe.objects.create(designation='RN9', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux upload',
            resume='Travaux upload',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        client = APIClient()
        client.force_authenticate(user=user)

        image = SimpleUploadedFile('photo.png', b'fake-image-data', content_type='image/png')
        response = client.post(
            '/api/travaux/avancements/',
            {
                'marche': str(marche.id),
                'date_avancement': '2026-10-07',
                'avancement_physique': '30',
                'avancement_financier': '20',
                'situation_w': 'En_cours',
                'detail_situation': 'Travaux de finition',
                'observation': 'Visite du site',
                'fichier': image,
                'legende': 'Photo du chantier',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, 201, response.data)
        avancement = Avancement.objects.get(pk=response.data['id'])
        self.assertTrue(avancement.medias.exists())
        self.assertEqual(avancement.medias.first().legende, 'Photo du chantier')
        self.assertTrue(MediaAvancement.objects.filter(avancement=avancement).exists())


class DashboardPeriodTests(SimpleTestCase):
    def test_future_date_in_current_year_is_kept_for_annual_dashboard(self):
        future_date = __import__('datetime').date(2026, 10, 12)
        self.assertTrue(_matches_dashboard_period(future_date, 'annee'))

    def test_past_date_is_kept_for_annual_dashboard(self):
        past_date = __import__('datetime').date(2026, 2, 10)
        self.assertTrue(_matches_dashboard_period(past_date, 'annee'))


class GeoUtilsTests(SimpleTestCase):
    def test_designation_to_ref_and_geojson_path(self):
        self.assertEqual(designation_to_ref('RN 2'), 'N 2')
        self.assertEqual(designation_to_ref('RN44'), 'N 44')
        self.assertTrue(designation_to_geojson_path('RN 2').exists())

    def test_extract_segment_between_pk_returns_expected_length(self):
        line = LineString([(0, 0), (1000, 0), (2000, 0)])
        segment = extract_segment_between_pk(line, 0.5, 1.5)
        self.assertAlmostEqual(segment.length, 1000.0, places=3)


class DiscussionSocketTests(TestCase):
    def test_ws_channel_accepts_connection_for_marche(self):
        User = get_user_model()
        user = User.objects.create_user(username='ws-user', password='secret123')
        axe = Axe.objects.create(designation='RN1', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux test',
            resume='Travaux test',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        communicator = WebsocketCommunicator(application, f'/ws/marche/{marche.pk}/')
        communicator.scope['user'] = user

        connected, _ = async_to_sync(communicator.connect)()
        self.assertTrue(connected)
        async_to_sync(communicator.disconnect)()

    def test_ws_can_create_message_for_marche(self):
        User = get_user_model()
        user = User.objects.create_user(username='ws-message-user', password='secret123')
        axe = Axe.objects.create(designation='RN2', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux socket',
            resume='Travaux socket',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        communicator = WebsocketCommunicator(application, f'/ws/marche/{marche.pk}/')
        communicator.scope['user'] = user

        connected, _ = async_to_sync(communicator.connect)()
        self.assertTrue(connected)

        async_to_sync(communicator.send_to)(json.dumps({
            'type': 'message.send',
            'marche': str(marche.pk),
            'contenu': 'Bonjour en temps réel',
            'client_message_id': 'test-client-id',
        }))

        payload = async_to_sync(communicator.receive_json_from)()
        self.assertEqual(payload['type'], 'message.created')
        self.assertEqual(payload['message']['contenu'], 'Bonjour en temps réel')
        self.assertEqual(payload['client_message_id'], 'test-client-id')

        async_to_sync(communicator.disconnect)()


class NotificationSystemTests(TestCase):
    def test_avancement_created_by_project_manager_notifies_admin_and_visitor(self):
        User = get_user_model()
        pm = User.objects.create_user(username='pm-notif', password='secret123')
        pm_group = Group.objects.create(name='chef_de_projet')
        pm.groups.add(pm_group)

        admin = User.objects.create_user(username='admin-notif', password='secret123')
        admin_group = Group.objects.create(name='admin')
        admin.groups.add(admin_group)

        visitor = User.objects.create_user(username='visitor-notif', password='secret123')
        visitor_group = Group.objects.create(name='visiteur')
        visitor.groups.add(visitor_group)

        axe = Axe.objects.create(designation='RN20', type_axe='RN', attache_suivi=pm)
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux notif',
            resume='Travaux notif',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        client = APIClient()
        client.force_authenticate(user=pm)

        response = client.post(
            '/api/travaux/avancements/',
            {
                'marche': str(marche.id),
                'date_avancement': '2026-10-07',
                'avancement_physique': '30',
                'avancement_financier': '20',
                'situation_w': 'En_cours',
                'detail_situation': 'Travaux de finition',
                'observation': 'Visite du site',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertFalse(Notification.objects.filter(user=pm, type='avancement_nouveau').exists())
        self.assertTrue(Notification.objects.filter(user=admin, type='avancement_nouveau').exists())
        self.assertTrue(Notification.objects.filter(user=visitor, type='avancement_nouveau').exists())

    def test_notification_unread_count_and_mark_read(self):
        User = get_user_model()
        user = User.objects.create_user(username='notif-user', password='secret123')
        axe = Axe.objects.create(designation='RN20', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux notif',
            resume='Travaux notif',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
        )

        Notification.objects.create(
            user=user,
            type='marche_assigne',
            title='Marché assigné',
            message='Le marché a été affecté à votre équipe.',
            related_model='Marche',
            related_id=str(marche.id),
        )

        self.assertEqual(Notification.objects.filter(user=user, is_read=False).count(), 1)

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/notifications/unread-count/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)

        response = client.post('/api/notifications/mark-read/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Notification.objects.filter(user=user, is_read=False).count(), 0)

    def test_dashboard_stats_include_budget_breakdown(self):
        User = get_user_model()
        admin = User.objects.create_user(username='admin-dashboard-breakdown', password='secret123', is_superuser=True)

        axe = Axe.objects.create(designation='RN30', type_axe='RN')
        marche = Marche.objects.create(
            axe=axe,
            description='Travaux budget',
            resume='Travaux budget',
            financement='RPI',
            tiers='Entreprise',
            titulaire='Titulaire',
            montant=250000,
        )
        Marche.objects.create(
            axe=axe,
            description='Travaux budget 2',
            resume='Travaux budget 2',
            financement='FR',
            tiers='Entreprise',
            titulaire='Titulaire',
            montant=120000,
        )

        Bac.objects.create(
            axe=axe,
            region='DIANA',
            localite='Ambodifotatra',
            besoin_entretien_bac=75000,
            etat_bac='Operationel',
        )

        ConventionProgramme.objects.create(
            axe=axe,
            section='Section 1',
            region='DIANA',
            annee=2026,
            pk_debut=10,
            localite_deb='A',
            pk_fin=20,
            localite_fin='B',
            longueur_traite=10,
            montant_minima=100000,
            montant_souhaite=180000,
        )

        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get('/api/apitp/dashboard/stats/?periode=annee')

        self.assertEqual(response.status_code, 200, response.data)
        summary = response.data['summary_cards']
        breakdown = summary['budget_breakdown']
        self.assertEqual(breakdown['travaux'], 370000.0)
        self.assertEqual(breakdown['bac'], 75000.0)
        self.assertEqual(breakdown['convention'], 180000.0)
        self.assertEqual(summary['budget_engage'], 625000.0)
