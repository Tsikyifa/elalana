from rest_framework.authentication import TokenAuthentication


class CookieTokenAuthentication(TokenAuthentication):
    keyword = 'Token'

    def authenticate(self, request):
        token = request.COOKIES.get('access_v3')  # ← BIEN 'access_v3'
        if not token:
            return None
        return self.authenticate_credentials(token)