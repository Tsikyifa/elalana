from django.test import SimpleTestCase, TestCase
from shapely.geometry import LineString

from apitp.geo_utils import designation_to_geojson_path, designation_to_ref, extract_segment_between_pk
from apitp.views import get_auth_cookie_config, _matches_dashboard_period
from apitp.serializers import MarcheWriteSerializer
from travaux.models import Axe, Marche


class AuthCookieConfigTests(SimpleTestCase):
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
