import logging
import requests
from datetime import datetime, timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from routing.serializers import RouteCalculationRequestSerializer
from routing.services.route_generator import get_three_routes
from routing.services.sampling_service import sample_route_checkpoints
from routing.services.weather_service import (
    fetch_batch_weather,
    extract_weather_at_timestamp,
    generate_hourly_risk_series,
)
from routing.services.risk_engine import (
    evaluate_checkpoint_risk,
    calculate_route_metrics,
    rank_routes,
)
from routing.services.heatmap_service import generate_corridor_heatmap_data

logger = logging.getLogger(__name__)

PHOTON_URL = "https://photon.komoot.io/api/"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
GEOCODING_USER_AGENT = "WeatherAwareTruckRouting/1.0 (dispatch@freight-routing.local)"

MAJOR_US_FREIGHT_HUBS = [
    {"name": "Denver, Colorado, United States", "lat": 39.7392, "lng": -104.9903},
    {"name": "Salt Lake City, Utah, United States", "lat": 40.7608, "lng": -111.8910},
    {"name": "Cheyenne, Wyoming, United States", "lat": 41.1400, "lng": -104.8202},
    {"name": "Omaha, Nebraska, United States", "lat": 41.2565, "lng": -95.9345},
    {"name": "Chicago, Illinois, United States", "lat": 41.8781, "lng": -87.6298},
    {"name": "Atlanta, Georgia, United States", "lat": 33.7490, "lng": -84.3880},
    {"name": "Dallas, Texas, United States", "lat": 32.7767, "lng": -96.7970},
    {"name": "Fort Worth, Texas, United States", "lat": 32.7555, "lng": -97.3308},
    {"name": "Houston, Texas, United States", "lat": 29.7604, "lng": -95.3698},
    {"name": "Kansas City, Missouri, United States", "lat": 39.0997, "lng": -94.5786},
    {"name": "Indianapolis, Indiana, United States", "lat": 39.7684, "lng": -86.1581},
    {"name": "Memphis, Tennessee, United States", "lat": 35.1495, "lng": -90.0490},
    {"name": "Nashville, Tennessee, United States", "lat": 36.1627, "lng": -86.7816},
    {"name": "Columbus, Ohio, United States", "lat": 39.9612, "lng": -82.9988},
    {"name": "Louisville, Kentucky, United States", "lat": 38.2527, "lng": -85.7585},
    {"name": "Saint Louis, Missouri, United States", "lat": 38.6270, "lng": -90.1994},
    {"name": "Minneapolis, Minnesota, United States", "lat": 44.9778, "lng": -93.2650},
    {"name": "Des Moines, Iowa, United States", "lat": 41.5868, "lng": -93.6250},
    {"name": "Los Angeles, California, United States", "lat": 34.0522, "lng": -118.2437},
    {"name": "Ontario, California, United States", "lat": 34.0633, "lng": -117.6509},
    {"name": "Phoenix, Arizona, United States", "lat": 33.4484, "lng": -112.0740},
    {"name": "Seattle, Washington, United States", "lat": 47.6062, "lng": -122.3321},
    {"name": "Portland, Oregon, United States", "lat": 45.5152, "lng": -122.6784},
    {"name": "Boise, Idaho, United States", "lat": 43.6150, "lng": -116.2023},
    {"name": "Albuquerque, New Mexico, United States", "lat": 35.0844, "lng": -106.6504},
    {"name": "Oklahoma City, Oklahoma, United States", "lat": 35.4676, "lng": -97.5164},
    {"name": "Detroit, Michigan, United States", "lat": 42.3314, "lng": -83.0458},
    {"name": "Pittsburgh, Pennsylvania, United States", "lat": 40.4406, "lng": -79.9959},
    {"name": "Philadelphia, Pennsylvania, United States", "lat": 39.9526, "lng": -75.1652},
    {"name": "Newark, New Jersey, United States", "lat": 40.7357, "lng": -74.1724},
    {"name": "Charlotte, North Carolina, United States", "lat": 35.2271, "lng": -80.8431},
    {"name": "Jacksonville, Florida, United States", "lat": 30.3322, "lng": -81.6557},
    {"name": "Miami, Florida, United States", "lat": 25.7617, "lng": -80.1918},
    {"name": "Tampa, Florida, United States", "lat": 27.9506, "lng": -82.4572},
    {"name": "New Orleans, Louisiana, United States", "lat": 29.9511, "lng": -90.0715},
]


class RouteCalculateView(APIView):
    """
    POST /api/routes/calculate/
    Generates 3 route alternatives, samples weather along checkpoints based on truck ETAs,
    applies risk thresholds and cargo escalation rules, ranks routes, and generates a
    corridor heatmap across the 0–48 hour timeline.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RouteCalculationRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        origin = data["origin"]
        dest = data["destination"]
        dep_time = data.get("departure_time") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        load_weight = data.get("load_weight", 0.0)
        interval_miles = float(data.get("sampling_interval_miles", 25))

        orig_coords = (origin["lat"], origin["lng"])
        dest_coords = (dest["lat"], dest["lng"])

        # 1. Generate 3 routes
        routes = get_three_routes(orig_coords, dest_coords)

        # 2. Sample checkpoints for each route
        all_coords_to_fetch = set()
        routes_checkpoints_map = {}

        for r in routes:
            coords = r["geometry"]["coordinates"]
            dist_m = r["distance_meters"]
            dur_s = r["duration_seconds"]
            cps = sample_route_checkpoints(
                coordinates=coords,
                total_distance_meters=dist_m,
                total_duration_seconds=dur_s,
                departure_time_iso=dep_time,
                sampling_interval_miles=interval_miles,
                truck_speed_adjustment_factor=1.15,
            )
            routes_checkpoints_map[r["id"]] = cps
            for cp in cps:
                loc = cp["location"]
                all_coords_to_fetch.add((loc["lat"], loc["lng"]))

        # 3. Batch fetch weather from Open-Meteo
        weather_map = fetch_batch_weather(list(all_coords_to_fetch), dep_time)

        # 4. Annotate checkpoints with weather and risk
        all_routes_checkpoints = []
        for r in routes:
            cps = routes_checkpoints_map[r["id"]]
            for cp in cps:
                loc = cp["location"]
                pt = (loc["lat"], loc["lng"])
                series = weather_map.get(pt, {})

                # Weather at physical arrival ETA
                w = extract_weather_at_timestamp(series, cp["eta"])
                cp["weather"] = w

                # Checkpoint risk at physical arrival ETA
                risk = evaluate_checkpoint_risk(
                    wind_mph=w["wind_speed_mph"],
                    rain_in_hr=w["rain_in_per_hr"],
                    snow_in_hr=w["snow_in_per_hr"],
                    load_weight_lbs=load_weight,
                )
                cp["risk"] = risk

                # Compact 49-hour risk series for real-time timeline slider scrubbing
                hourly_scores = generate_hourly_risk_series(
                    series,
                    departure_time_iso=dep_time,
                    load_weight_lbs=load_weight,
                    num_hours=49,
                )
                cp["hourly_risk_scores"] = hourly_scores

            # Calculate route metrics
            r["risk_metrics"] = calculate_route_metrics(
                checkpoints=cps,
                total_distance_miles=r["distance_miles"],
                duration_hours=r["duration_hours"],
            )
            r["checkpoints"] = cps
            all_routes_checkpoints.append(cps)

        # 5. Rank routes
        ranked_routes, rationale, all_no_travel_warning = rank_routes(routes)

        # 6. Generate corridor heatmap surface
        heatmap_data = generate_corridor_heatmap_data(
            routes_checkpoints=all_routes_checkpoints,
            departure_time_iso=dep_time,
            num_hours=49,
        )

        recommended_id = ranked_routes[0]["id"] if ranked_routes else None

        return Response(
            {
                "recommended_route_id": recommended_id,
                "recommendation_rationale": rationale,
                "all_no_travel_warning": all_no_travel_warning,
                "routes": ranked_routes,
                "corridor_heatmap": heatmap_data,
            },
            status=status.HTTP_200_OK,
        )


class GeocodingSearchView(APIView):
    """
    GET /api/geocoding/search/?q={query}
    High-availability autocomplete location search proxy.
    Primary: Photon (OSM geocoder) with proper User-Agent header.
    Secondary: Nominatim (OSM search API).
    Tertiary: Curated offline dictionary of 35+ major US freight hubs.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.GET.get("q", "").strip()
        if not query or len(query) < 2:
            return Response([])

        headers = {"User-Agent": GEOCODING_USER_AGENT}

        # 1. Primary: Photon geocoder
        try:
            resp = requests.get(
                PHOTON_URL,
                params={"q": query, "limit": 10, "lang": "en"},
                headers=headers,
                timeout=4,
            )
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                results = []
                for f in features:
                    geom = f.get("geometry", {})
                    props = f.get("properties", {})
                    coords = geom.get("coordinates", [])
                    if len(coords) >= 2:
                        name_parts = [props.get("name", "")]
                        if props.get("state"):
                            name_parts.append(props["state"])
                        if props.get("country"):
                            name_parts.append(props["country"])
                        label = ", ".join([p for p in name_parts if p])

                        results.append(
                            {
                                "name": label,
                                "lat": round(coords[1], 4),
                                "lng": round(coords[0], 4),
                            }
                        )
                if results:
                    return Response(results)
        except Exception as e:
            logger.warning(f"Photon geocoding error: {e}")

        # 2. Secondary fallback: Nominatim
        try:
            nom_resp = requests.get(
                NOMINATIM_URL,
                params={
                    "q": query,
                    "format": "json",
                    "limit": 8,
                    "countrycodes": "us,ca",
                },
                headers=headers,
                timeout=4,
            )
            if nom_resp.status_code == 200:
                nom_items = nom_resp.json()
                results = []
                for item in nom_items:
                    display_name = item.get("display_name", "")
                    lat_str = item.get("lat")
                    lon_str = item.get("lon")
                    if lat_str and lon_str:
                        # Clean up display name (e.g. keep first 3 parts)
                        parts = [p.strip() for p in display_name.split(",")]
                        cleaned = ", ".join(parts[:3]) if len(parts) >= 3 else display_name
                        results.append(
                            {
                                "name": cleaned,
                                "lat": round(float(lat_str), 4),
                                "lng": round(float(lon_str), 4),
                            }
                        )
                if results:
                    return Response(results)
        except Exception as e:
            logger.warning(f"Nominatim geocoding fallback error: {e}")

        # 3. Tertiary offline freight hub dictionary
        q_lower = query.lower()
        matched = [h for h in MAJOR_US_FREIGHT_HUBS if q_lower in h["name"].lower()]
        return Response(matched[:8] if matched else MAJOR_US_FREIGHT_HUBS[:6])
