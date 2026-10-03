"""Turn the phone's GPS coordinates into a place name the assistant can use."""

import logging
import threading

import httpx2

log = logging.getLogger("location")
_cache: dict[tuple[float, float], str] = {}
_lock = threading.Lock()


def describe(lat: float, lng: float) -> str:
    """Return a short place description like "Hanif Park, Mansoorah, Lahore, Pakistan (31.48, 74.28)".

    Uses OpenStreetMap's free Nominatim service; falls back to raw coordinates if it is unreachable.
    """
    key = (round(lat, 3), round(lng, 3))  # ~100 m; avoids repeat lookups while the user stays put
    with _lock:
        if key in _cache:
            return _cache[key]
    coords = f"({lat:.4f}, {lng:.4f})"
    place = ""
    try:
        r = httpx2.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "jsonv2", "zoom": 16, "accept-language": "en"},
            headers={"User-Agent": "Zuzu-voice-assistant/1.0"},
            timeout=6,
        )
        r.raise_for_status()
        addr = r.json().get("address", {})
        parts = [
            addr.get("neighbourhood") or addr.get("residential") or addr.get("suburb"),
            addr.get("suburb") if addr.get("neighbourhood") or addr.get("residential") else None,
            addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county"),
            addr.get("country"),
        ]
        seen = []
        for p in parts:
            if p and p not in seen:
                seen.append(p)
        place = ", ".join(seen)
    except (httpx2.HTTPError, ValueError) as e:
        log.warning("Reverse geocoding failed: %s", e)
    result = f"{place} {coords}" if place else coords
    with _lock:
        _cache[key] = result
    return result
