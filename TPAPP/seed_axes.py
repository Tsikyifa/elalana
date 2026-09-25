#!/usr/bin/env python
"""
Script autonome pour insérer / synchroniser les axes routiers majeurs de Madagascar.
Usage :
    python seed_axes.py
    ou
    python manage.py seed_axes
"""
import os
import sys

# Configuration Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'TPAPP.settings')

import django
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    args = sys.argv[1:]
    call_command('seed_axes', *args)
