from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings


@csrf_exempt
def purge_old_session_cookies(request):
    """Endpoint that instructs the browser to clear old sessionid cookies
    on the `.elalana.mg` domain. This must be called from the browser (GET).
    It returns Set-Cookie headers with Max-Age=0 and Domain=.elalana.mg so
    the browser removes legacy cookies.
    """
    cookie_names = ('access_v3', 'access_v2', 'access', 'sessionid', 'sessionid_v2', 'sessionid_v3', 'sessionid_elalana')
    response = JsonResponse({'purged': list(cookie_names)})
    for samesite in ('None', 'Lax'):
        secure_flag = True  # production only usage assumed
        for name in cookie_names:
            response.set_cookie(
                key=name,
                value='',
                max_age=0,
                expires='Thu, 01 Jan 1970 00:00:00 GMT',
                path='/',
                domain='.elalana.mg',
                secure=secure_flag,
                httponly=True,
                samesite=samesite,
            )
    return response
