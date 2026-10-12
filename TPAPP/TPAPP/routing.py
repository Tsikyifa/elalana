from django.urls import re_path

from apitp import consumers

websocket_urlpatterns = [
    re_path(r"ws/marche/(?P<marche_id>[^/]+)/$", consumers.MarcheDiscussionConsumer.as_asgi()),
    re_path(r"ws/notifications/$", consumers.NotificationConsumer.as_asgi()),
]
