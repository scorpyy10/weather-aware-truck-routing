import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
import requests
from django.core.cache import cache

from routing.services.risk_engine import evaluate_checkpoint_risk
from routing.services.sampling_service import parse_iso_datetime

logger = logging.getLogger(__name__)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
BATCH_CHUNK_SIZE = 40  # coordinates per HTTP request


def weather_code_to_condition(code: int) -> str:
    """Translates WMO weather interpretation code into human-readable condition."""
    mapping = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Freezing fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        61: "Slight Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        71: "Slight Snowfall",
        73: "Moderate Snowfall",
        75: "Heavy Snowfall",
        77: "Snow Grains",
        80: "Slight Rain Showers",
        81: "Moderate Rain Showers",
        82: "Violent Rain Showers",
        85: "Slight Snow Showers",
        86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm with Hail",
        99: "Severe Thunderstorm with Hail",
    }
    return mapping.get(code, "Variable conditions")


def make_cache_key(lat: float, lon: float, date_prefix: str) -> str:
    return f"wx_{round(lat, 2)}_{round(lon, 2)}_{date_prefix}"


def create_synthetic_hourly_weather(num_hours: int = 72) -> Dict[str, Any]:
    """Fallback weather series when Open-Meteo cannot be reached."""
    now = datetime.now(timezone.utc)
    times = [(now + timedelta(hours=i)).strftime("%Y-%m-%dT%H:00") for i in range(num_hours)]
    return {
        "time": times,
        "wind_speed_10m": [18.0] * num_hours,
        "rain": [0.0] * num_hours,
        "snowfall": [0.0] * num_hours,
        "temperature_2m": [52.0] * num_hours,
        "weather_code": [1] * num_hours,
    }


def fetch_batch_weather(
    coordinates: List[Tuple[float, float]],
    departure_time_iso: str,
) -> Dict[Tuple[float, float], Dict[str, Any]]:
    """
    Fetches hourly weather forecasts for multiple coordinates from Open-Meteo in batched queries.
    Utilizes in-memory caching to prevent duplicate API roundtrips.
    """
    if not coordinates:
        return {}

    dep_dt = parse_iso_datetime(departure_time_iso)
    date_prefix = dep_dt.strftime("%Y%m%d%H")

    results: Dict[Tuple[float, float], Dict[str, Any]] = {}
    missing_coords: List[Tuple[float, float]] = []

    # Check cache first
    for pt in coordinates:
        ckey = make_cache_key(pt[0], pt[1], date_prefix)
        cached_data = cache.get(ckey)
        if cached_data:
            results[pt] = cached_data
        else:
            missing_coords.append(pt)

    if not missing_coords:
        return results

    # Chunk missing coordinates into batches of up to BATCH_CHUNK_SIZE
    for i in range(0, len(missing_coords), BATCH_CHUNK_SIZE):
        chunk = missing_coords[i : i + BATCH_CHUNK_SIZE]
        lats_str = ",".join([str(round(p[0], 4)) for p in chunk])
        lons_str = ",".join([str(round(p[1], 4)) for p in chunk])

        params = {
            "latitude": lats_str,
            "longitude": lons_str,
            "hourly": "temperature_2m,wind_speed_10m,rain,snowfall,weather_code",
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "forecast_days": 7,
        }

        try:
            resp = requests.get(OPEN_METEO_URL, params=params, timeout=6)
            if resp.status_code == 200:
                data = resp.json()
                # Open-Meteo returns a list of results if multiple points queried, or a dict if 1 point
                if isinstance(data, list):
                    for idx, pt in enumerate(chunk):
                        if idx < len(data) and "hourly" in data[idx]:
                            hourly = data[idx]["hourly"]
                            results[pt] = hourly
                            cache.set(make_cache_key(pt[0], pt[1], date_prefix), hourly, 1800)
                elif isinstance(data, dict) and "hourly" in data:
                    pt = chunk[0]
                    hourly = data["hourly"]
                    results[pt] = hourly
                    cache.set(make_cache_key(pt[0], pt[1], date_prefix), hourly, 1800)
        except Exception as e:
            logger.warning(f"Open-Meteo batch request error: {e}")

    # For any coordinates that still failed to fetch, populate with synthetic baseline
    for pt in missing_coords:
        if pt not in results:
            synth = create_synthetic_hourly_weather()
            results[pt] = synth

    return results


def extract_weather_at_timestamp(
    hourly_series: Dict[str, Any], timestamp_iso: str
) -> Dict[str, Any]:
    """
    Finds the forecast weather metrics closest to the target timestamp.
    """
    times = hourly_series.get("time", [])
    if not times:
        return {
            "wind_speed_mph": 0.0,
            "rain_in_per_hr": 0.0,
            "snow_in_per_hr": 0.0,
            "temp_f": 60.0,
            "condition": "Clear sky",
        }

    target_dt = parse_iso_datetime(timestamp_iso)
    # Target formatted as YYYY-MM-DDTHH:00
    target_str = target_dt.strftime("%Y-%m-%dT%H:00")

    best_idx = 0
    if target_str in times:
        best_idx = times.index(target_str)
    else:
        # Find closest hour by timestamp difference
        min_diff = float("inf")
        for idx, t_str in enumerate(times):
            try:
                t_dt = parse_iso_datetime(t_str)
                diff = abs((t_dt - target_dt).total_seconds())
                if diff < min_diff:
                    min_diff = diff
                    best_idx = idx
            except Exception:
                continue

    winds = hourly_series.get("wind_speed_10m", [])
    rains = hourly_series.get("rain", [])
    snows = hourly_series.get("snowfall", [])
    temps = hourly_series.get("temperature_2m", [])
    codes = hourly_series.get("weather_code", [])

    wind = winds[best_idx] if best_idx < len(winds) else 0.0
    rain = rains[best_idx] if best_idx < len(rains) else 0.0
    snow = snows[best_idx] if best_idx < len(snows) else 0.0
    temp = temps[best_idx] if best_idx < len(temps) else 60.0
    code = codes[best_idx] if best_idx < len(codes) else 0

    return {
        "wind_speed_mph": round(float(wind), 1),
        "rain_in_per_hr": round(float(rain), 2),
        "snow_in_per_hr": round(float(snow), 2),
        "temp_f": round(float(temp), 1),
        "condition": weather_code_to_condition(int(code)),
    }


def generate_hourly_risk_series(
    hourly_series: Dict[str, Any],
    departure_time_iso: str,
    load_weight_lbs: float,
    num_hours: int = 49,
) -> List[int]:
    """
    Computes a sequence of risk score integers (1..5) for hours 0 to num_hours-1
    relative to the given departure time.
    """
    dep_dt = parse_iso_datetime(departure_time_iso)
    risk_scores = []

    for h in range(num_hours):
        target_dt = dep_dt + timedelta(hours=h)
        target_iso = target_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        w = extract_weather_at_timestamp(hourly_series, target_iso)
        risk = evaluate_checkpoint_risk(
            wind_mph=w["wind_speed_mph"],
            rain_in_hr=w["rain_in_per_hr"],
            snow_in_hr=w["snow_in_per_hr"],
            load_weight_lbs=load_weight_lbs,
        )
        risk_scores.append(risk["score"])

    return risk_scores
