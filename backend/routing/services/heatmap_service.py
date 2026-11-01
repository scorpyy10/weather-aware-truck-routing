from datetime import timedelta
from typing import List, Dict, Any
from routing.services.risk_engine import RiskLevel
from routing.services.sampling_service import parse_iso_datetime


def generate_corridor_heatmap_data(
    routes_checkpoints: List[List[Dict[str, Any]]],
    departure_time_iso: str,
    num_hours: int = 49,
) -> Dict[str, Any]:
    """
    Constructs a 0–48 hour corridor weather risk heatmap surface.
    Uses checkpoints from all active routes as spatial grid sample nodes.
    Intensity is mathematically derived from the load-weighted risk score (score / 5.0).
    """
    dep_dt = parse_iso_datetime(departure_time_iso)

    # Collect distinct spatial checkpoint coordinates across all routes
    unique_nodes: Dict[str, Dict[str, Any]] = {}
    for cp_list in routes_checkpoints:
        for cp in cp_list:
            loc = cp.get("location", {})
            lat = round(loc.get("lat", 0.0), 4)
            lng = round(loc.get("lng", 0.0), 4)
            key = f"{lat}_{lng}"
            if key not in unique_nodes:
                unique_nodes[key] = {
                    "lat": lat,
                    "lng": lng,
                    "hourly_risk_scores": cp.get("hourly_risk_scores", [1] * num_hours),
                }

    if not unique_nodes:
        return {"bounds": [[-125.0, 25.0], [-65.0, 50.0]], "hours": []}

    # Calculate corridor bounding box with 0.5-degree margin
    all_lats = [n["lat"] for n in unique_nodes.values()]
    all_lngs = [n["lng"] for n in unique_nodes.values()]
    bounds = [
        [round(min(all_lngs) - 0.5, 3), round(min(all_lats) - 0.5, 3)],
        [round(max(all_lngs) + 0.5, 3), round(max(all_lats) + 0.5, 3)],
    ]

    hours = []
    for h in range(num_hours):
        t_dt = dep_dt + timedelta(hours=h)
        grid_points = []
        for node in unique_nodes.values():
            scores = node.get("hourly_risk_scores", [1] * num_hours)
            score = scores[h] if h < len(scores) else 1
            risk_lvl = RiskLevel(score).label
            grid_points.append(
                {
                    "lat": node["lat"],
                    "lng": node["lng"],
                    "intensity": round(score / 5.0, 2),
                    "risk_level": risk_lvl,
                }
            )

        hours.append(
            {
                "hour_offset": h,
                "timestamp": t_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "grid_points": grid_points,
            }
        )

    return {"bounds": bounds, "hours": hours}
