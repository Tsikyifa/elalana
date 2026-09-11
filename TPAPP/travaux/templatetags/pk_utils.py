# reporting/templatetags/pk_utils.py
from django import template

register = template.Library()

@register.filter
def format_pk(value):
    try:
        val = float(value)
        entiere = int(val)
        # On calcule les mètres (partie décimale)
        metres = int(round((val - entiere) * 1000))
        return f"{entiere:03d}+{metres:03d}"
    except (ValueError, TypeError):
        return value
    
@register.filter
def get_item(dictionary, key):
    """Permet d'accéder à une clé de dictionnaire dynamiquement"""
    return dictionary.get(key, 0)

@register.filter
def replace_underscore(value):
    """Remplace les underscores par des espaces pour l'affichage"""
    if isinstance(value, str):
        return value.replace('_', ' ')
    return value