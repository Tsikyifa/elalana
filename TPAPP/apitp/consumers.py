import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model

from apitp.serializers import MessageMarcheSerializer, NotificationSerializer
from travaux.models import MessageMarche


class DummyRequest:
    def __init__(self, user):
        self.user = user

    def build_absolute_uri(self, url):
        return url


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=1008)
            return

        self.user_id = self.scope["user"].id
        self.group_name = f"user_notifications_{self.user_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            return
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if payload.get("type") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))
            return

    async def notification_message(self, event):
        payload = event.get("payload", {})
        await self.send(text_data=json.dumps(payload, default=str))


class MarcheDiscussionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.scope["user"].is_authenticated:
            await self.close(code=1008)
            return

        self.marche_id = self.scope["url_route"]["kwargs"]["marche_id"]
        self.group_name = f"marche_discussion_{self.marche_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    @database_sync_to_async
    def _create_message_from_ws(self, contenu, client_message_id):
        user = self.scope["user"]
        message = MessageMarche.objects.create(
            marche_id=self.marche_id,
            auteur=user,
            contenu=contenu,
        )
        serializer = MessageMarcheSerializer(message, context={'request': DummyRequest(user)})
        return serializer.data, message.pk, client_message_id

    async def receive(self, text_data=None, bytes_data=None):
        if text_data is None:
            return
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if payload.get("type") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))
            return

        if payload.get("type") == "message.send":
            contenu = (payload.get("contenu") or '').strip()
            if not contenu:
                return

            client_message_id = payload.get("client_message_id")
            serialized_data, message_id, client_message_id = await self._create_message_from_ws(contenu, client_message_id)

            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'discussion.message',
                    'payload': {
                        'type': 'message.created',
                        'marche_id': str(self.marche_id),
                        'message_id': message_id,
                        'client_message_id': client_message_id,
                        'message': serialized_data,
                    },
                },
            )

    async def discussion_message(self, event):
        payload = event.get("payload", {})
        await self.send(text_data=json.dumps(payload, default=str))
