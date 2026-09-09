"""Shared brand hue from the website; Blender materials use linear RGB."""
import json
from pathlib import Path

BRAND = json.loads((Path(__file__).resolve().parent.parent / 'public' / 'theme.json').read_text())['brand']

def tone(strength=1, tint=0):
    def linear(value):
        return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4
    rgb = [linear(int(BRAND[i:i+2], 16) / 255) for i in (1, 3, 5)]
    return tuple((c * (1-tint) + tint) * strength for c in rgb)
