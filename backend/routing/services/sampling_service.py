import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple


EARTH_RADIUS_MILES = 3958.8
METERS_PER_MILE = 1609.344


def haversine_distance_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great circle distance between two points in miles."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return EARTH_RADIUS_MILES * c


def interpolate_point(
    p1: Tuple[float, float], p2: Tuple[float, float], fraction: float
) -> Tuple[float, float]:
    """Linear interpolation between two (lat, lon) coordinates."""
    lat = p1[0] + (p2[0] - p1[0]) * fraction
    lon = p1[1] + (p2[1] - p1[1]) * fraction
    return round(lat, 5), round(lon, 5)


def parse_iso_datetime(dt_str: str) -> datetime:
    """Parses ISO datetime string into UTC datetime object."""
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        cleaned = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def sample_route_checkpoints(
    coordinates: List[List[float]],  # [[lon, lat], ...] as returned by GeoJSON
    total_distance_meters: float,
    total_duration_seconds: float,
    departure_time_iso: str,
    sampling_interval_miles: float = 25.0,
    truck_speed_adjustment_factor: float = 1.15,
) -> List[Dict[str, Any]]:
    """
    Samples checkpoints along a GeoJSON coordinates path at exact mile intervals.
    Calculates arrival time (ETA) based on calibrated commercial truck speed profile.
    """
    if not coordinates or len(coordinates) < 2:
        return []

    # GeoJSON coordinates are [lon, lat], convert to (lat, lon) pairs
    lat_lon_points = [(c[1], c[0]) for c in coordinates]

    # Calculate cumulative distance along polyline segments
    cum_distances = [0.0]
    for i in range(1, len(lat_lon_points)):
        d = haversine_distance_miles(
            lat_lon_points[i - 1][0],
            lat_lon_points[i - 1][1],
            lat_lon_points[i][0],
            lat_lon_points[i][1],
        )
        cum_distances.append(cum_distances[-1] + d)

    calc_total_miles = cum_distances[-1]
    total_miles = (
        total_distance_meters / METERS_PER_MILE
        if total_distance_meters > 0
        else calc_total_miles
    )

    # Ratio to scale cumulative distances if routing engine distance differs slightly from Haversine sum
    dist_scale = total_miles / calc_total_miles if calc_total_miles > 0 else 1.0

    # Determine target sample distances
    if total_miles <= sampling_interval_miles:
        target_distances = [0.0, total_miles]
    else:
        target_distances = []
        d = 0.0
        while d < total_miles - (sampling_interval_miles * 0.25):
            target_distances.append(d)
            d += sampling_interval_miles
        target_distances.append(total_miles)

    # Calibrate truck duration
    calibrated_duration_sec = total_duration_seconds * truck_speed_adjustment_factor
    dep_dt = parse_iso_datetime(departure_time_iso)

    # Extract checkpoint points along polyline
    raw_checkpoints = []
    poly_idx = 0

    for target_d in target_distances:
        # Scale back to polyline cumulative distance space
        needed_cum_d = target_d / dist_scale if dist_scale > 0 else target_d

        while (
            poly_idx < len(cum_distances) - 1
            and cum_distances[poly_idx + 1] < needed_cum_d
        ):
            poly_idx += 1

        if poly_idx >= len(cum_distances) - 1:
            pt = lat_lon_points[-1]
        else:
            seg_len = cum_distances[poly_idx + 1] - cum_distances[poly_idx]
            if seg_len > 0:
                frac = (needed_cum_d - cum_distances[poly_idx]) / seg_len
                frac = max(0.0, min(1.0, frac))
            else:
                frac = 0.0
            pt = interpolate_point(
                lat_lon_points[poly_idx], lat_lon_points[poly_idx + 1], frac
            )

        # ETA calculation
        progress_frac = target_d / total_miles if total_miles > 0 else 0.0
        eta_seconds = calibrated_duration_sec * progress_frac
        eta_dt = dep_dt + timedelta(seconds=eta_seconds)

        raw_checkpoints.append(
            {
                "distance_miles": round(target_d, 1),
                "location": {"lat": pt[0], "lng": pt[1]},
                "eta": eta_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )

    # Compute Voronoi/midpoint segment miles for each checkpoint so the sum equals total_miles
    N = len(raw_checkpoints)
    checkpoints = []
    for i in range(N):
        d_curr = raw_checkpoints[i]["distance_miles"]
        if N == 1:
            seg_miles = total_miles
        elif N == 2:
            seg_miles = total_miles / 2.0
        else:
            if i == 0:
                seg_miles = (raw_checkpoints[1]["distance_miles"] - d_curr) / 2.0
            elif i == N - 1:
                seg_miles = (d_curr - raw_checkpoints[N - 2]["distance_miles"]) / 2.0
            else:
                seg_miles = (
                    raw_checkpoints[i + 1]["distance_miles"]
                    - raw_checkpoints[i - 1]["distance_miles"]
                ) / 2.0

        checkpoints.append(
            {
                "index": i,
                "distance_from_start_miles": d_curr,
                "segment_miles": round(seg_miles, 1),
                "location": raw_checkpoints[i]["location"],
                "eta": raw_checkpoints[i]["eta"],
            }
        )

    return checkpoints
