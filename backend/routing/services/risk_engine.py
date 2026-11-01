from enum import IntEnum
from typing import Dict, Any, List, Tuple


class RiskLevel(IntEnum):
    LOW = 1
    MODERATE = 2
    HIGH = 3
    SEVERE = 4
    NO_TRAVEL = 5

    @property
    def label(self) -> str:
        names = {
            1: "Low",
            2: "Moderate",
            3: "High",
            4: "Severe",
            5: "No Travel",
        }
        return names[self.value]


def classify_wind(wind_mph: float, load_weight_lbs: float) -> Tuple[RiskLevel, str]:
    """
    Classifies wind risk according to the assessment thresholds:
    - <25 mph: Low
    - 25–34 mph: Moderate
    - 35–44 mph: High
    - 45–54 mph: Severe
    - >=55 mph: No Travel

    And applies cargo load escalation rules:
    - >=55 mph -> No Travel for any load
    - 45–54 mph + >30,000 lb -> No Travel
    - 35–44 mph + >40,000 lb -> Severe
    """
    if wind_mph >= 55.0:
        return RiskLevel.NO_TRAVEL, f"Wind {wind_mph:.1f} mph (≥55 mph) → No Travel for any load"

    # Base wind classification
    if wind_mph < 25.0:
        base_level = RiskLevel.LOW
        base_reason = f"Wind {wind_mph:.1f} mph (<25 mph) → Low"
    elif wind_mph < 35.0:
        base_level = RiskLevel.MODERATE
        base_reason = f"Wind {wind_mph:.1f} mph (25–34 mph) → Moderate"
    elif wind_mph < 45.0:
        base_level = RiskLevel.HIGH
        base_reason = f"Wind {wind_mph:.1f} mph (35–44 mph) → High"
    else:  # 45.0 to 54.9 mph
        base_level = RiskLevel.SEVERE
        base_reason = f"Wind {wind_mph:.1f} mph (45–54 mph) → Severe"

    # Load weight escalation checks
    if 45.0 <= wind_mph < 55.0 and load_weight_lbs > 30000:
        return RiskLevel.NO_TRAVEL, (
            f"Wind {wind_mph:.1f} mph (45–54 mph) + Load {load_weight_lbs:,.0f} lb (>30,000 lb) → No Travel"
        )
    if 35.0 <= wind_mph < 45.0 and load_weight_lbs > 40000:
        return RiskLevel.SEVERE, (
            f"Wind {wind_mph:.1f} mph (35–44 mph) + Load {load_weight_lbs:,.0f} lb (>40,000 lb) → Severe"
        )

    return base_level, base_reason


def classify_rain(rain_in_hr: float) -> Tuple[RiskLevel, str]:
    """
    Classifies rain risk according to assessment thresholds:
    - <0.10 in/hr: Low
    - 0.10–0.25: Moderate
    - 0.25–0.50: High
    - 0.50–1.00: Severe
    - >1.00 in/hr: No Travel
    """
    if rain_in_hr < 0.10:
        return RiskLevel.LOW, f"Rain {rain_in_hr:.2f} in/hr (<0.10 in/hr) → Low"
    elif rain_in_hr < 0.25:
        return RiskLevel.MODERATE, f"Rain {rain_in_hr:.2f} in/hr (0.10–0.25 in/hr) → Moderate"
    elif rain_in_hr < 0.50:
        return RiskLevel.HIGH, f"Rain {rain_in_hr:.2f} in/hr (0.25–0.50 in/hr) → High"
    elif rain_in_hr <= 1.00:
        return RiskLevel.SEVERE, f"Rain {rain_in_hr:.2f} in/hr (0.50–1.00 in/hr) → Severe"
    else:
        return RiskLevel.NO_TRAVEL, f"Rain {rain_in_hr:.2f} in/hr (>1.00 in/hr) → No Travel"


def classify_snow(snow_in_hr: float) -> Tuple[RiskLevel, str]:
    """
    Classifies snow risk according to assessment thresholds:
    - <0.5 in/hr: Low
    - 0.5–1.0: Moderate
    - 1.0–2.0: High
    - 2.0–3.0: Severe
    - >3.0 in/hr: No Travel
    """
    if snow_in_hr < 0.5:
        return RiskLevel.LOW, f"Snow {snow_in_hr:.2f} in/hr (<0.5 in/hr) → Low"
    elif snow_in_hr < 1.0:
        return RiskLevel.MODERATE, f"Snow {snow_in_hr:.2f} in/hr (0.5–1.0 in/hr) → Moderate"
    elif snow_in_hr < 2.0:
        return RiskLevel.HIGH, f"Snow {snow_in_hr:.2f} in/hr (1.0–2.0 in/hr) → High"
    elif snow_in_hr <= 3.0:
        return RiskLevel.SEVERE, f"Snow {snow_in_hr:.2f} in/hr (2.0–3.0 in/hr) → Severe"
    else:
        return RiskLevel.NO_TRAVEL, f"Snow {snow_in_hr:.2f} in/hr (>3.0 in/hr) → No Travel"


def evaluate_checkpoint_risk(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
    load_weight_lbs: float,
) -> Dict[str, Any]:
    """
    Calculates overall checkpoint risk using worst-case aggregation:
    Risk = max(WindWithLoad, Rain, Snow)
    """
    wind_lvl, wind_reason = classify_wind(wind_mph, load_weight_lbs)
    rain_lvl, rain_reason = classify_rain(rain_in_hr)
    snow_lvl, snow_reason = classify_snow(snow_in_hr)

    worst_lvl = max(wind_lvl, rain_lvl, snow_lvl)

    # Determine dominant triggering rule
    trigger_rules = []
    if wind_lvl == worst_lvl:
        trigger_rules.append(wind_reason)
    if rain_lvl == worst_lvl and rain_lvl > RiskLevel.LOW:
        trigger_rules.append(rain_reason)
    if snow_lvl == worst_lvl and snow_lvl > RiskLevel.LOW:
        trigger_rules.append(snow_reason)

    if not trigger_rules:
        trigger_rules.append(wind_reason)

    return {
        "level": worst_lvl.label,
        "score": int(worst_lvl),
        "trigger_rule": " | ".join(trigger_rules),
        "hazards": {
            "wind": {"level": wind_lvl.label, "score": int(wind_lvl), "reason": wind_reason},
            "rain": {"level": rain_lvl.label, "score": int(rain_lvl), "reason": rain_reason},
            "snow": {"level": snow_lvl.label, "score": int(snow_lvl), "reason": snow_reason},
        },
    }


def calculate_route_metrics(
    checkpoints: List[Dict[str, Any]],
    total_distance_miles: float,
    duration_hours: float,
) -> Dict[str, Any]:
    """
    Computes distance-weighted risk metrics from sampled checkpoints.
    Each checkpoint represents a segment distance in miles.
    """
    no_travel_miles = 0.0
    severe_miles = 0.0
    high_miles = 0.0
    moderate_miles = 0.0
    low_miles = 0.0
    weighted_score_sum = 0.0
    total_segment_miles = 0.0

    for cp in checkpoints:
        seg_miles = cp.get("segment_miles", 0.0)
        risk = cp.get("risk", {})
        score = risk.get("score", 1)
        level = risk.get("level", "Low")

        total_segment_miles += seg_miles
        weighted_score_sum += score * seg_miles

        if level == "No Travel":
            no_travel_miles += seg_miles
        elif level == "Severe":
            severe_miles += seg_miles
        elif level == "High":
            high_miles += seg_miles
        elif level == "Moderate":
            moderate_miles += seg_miles
        else:
            low_miles += seg_miles

    avg_risk = (
        round(weighted_score_sum / total_segment_miles, 2)
        if total_segment_miles > 0
        else 1.0
    )

    return {
        "total_distance_miles": round(total_distance_miles, 1),
        "duration_hours": round(duration_hours, 1),
        "no_travel_miles": round(no_travel_miles, 1),
        "severe_miles": round(severe_miles, 1),
        "high_miles": round(high_miles, 1),
        "moderate_miles": round(moderate_miles, 1),
        "low_miles": round(low_miles, 1),
        "average_risk": avg_risk,
    }


def rank_routes(routes: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str, bool]:
    """
    Ranks routes according to assessment preferences:
    0. Fewest No Travel miles (critical safety gate)
    1. Fewest Severe miles
    2. Fewest High miles
    3. Lowest average risk
    4. Shortest travel times

    Returns (ranked_routes, rationale_summary, all_no_travel_warning)
    """
    if not routes:
        return [], "No routes available", False

    # Check if all routes encounter No Travel
    all_no_travel_warning = all(
        r.get("risk_metrics", {}).get("no_travel_miles", 0.0) > 0 for r in routes
    )

    def sort_key(r: Dict[str, Any]):
        m = r.get("risk_metrics", {})
        return (
            m.get("no_travel_miles", 0.0),
            m.get("severe_miles", 0.0),
            m.get("high_miles", 0.0),
            round(m.get("average_risk", 1.0), 2),
            round(r.get("duration_hours", 0.0), 2),
        )

    sorted_routes = sorted(routes, key=sort_key)

    # Tag recommendation
    for i, r in enumerate(sorted_routes):
        r["is_recommended"] = (i == 0)
        r["rank"] = i + 1

    winner = sorted_routes[0]
    wm = winner.get("risk_metrics", {})

    if all_no_travel_warning:
        rationale = (
            f"⚠️ All available routes encounter No Travel conditions. "
            f"'{winner.get('name', 'Route 1')}' is least hazardous with {wm.get('no_travel_miles', 0)} No Travel miles, "
            f"but postponing departure until weather clears is strongly recommended."
        )
    else:
        # Build comparison details against runners-up
        reasons = []
        if len(sorted_routes) > 1:
            r2 = sorted_routes[1]
            r2m = r2.get("risk_metrics", {})
            if wm.get("no_travel_miles", 0) < r2m.get("no_travel_miles", 0):
                reasons.append(
                    f"{wm.get('no_travel_miles', 0)} No Travel miles vs {r2m.get('no_travel_miles', 0)} on {r2.get('name', 'Route 2')}"
                )
            elif wm.get("severe_miles", 0) < r2m.get("severe_miles", 0):
                reasons.append(
                    f"{wm.get('severe_miles', 0)} Severe miles vs {r2m.get('severe_miles', 0)} on {r2.get('name', 'Route 2')}"
                )
            elif wm.get("high_miles", 0) < r2m.get("high_miles", 0):
                reasons.append(
                    f"{wm.get('high_miles', 0)} High miles vs {r2m.get('high_miles', 0)} on {r2.get('name', 'Route 2')}"
                )
            elif wm.get("average_risk", 0) < r2m.get("average_risk", 0):
                reasons.append(
                    f"lower average risk ({wm.get('average_risk', 0):.2f} vs {r2m.get('average_risk', 0):.2f})"
                )
            elif winner.get("duration_hours", 0) < r2.get("duration_hours", 0):
                diff_min = int((r2.get("duration_hours", 0) - winner.get("duration_hours", 0)) * 60)
                reasons.append(f"{diff_min} mins faster transit time")

        comparison_text = f" ({', '.join(reasons)})" if reasons else ""
        rationale = (
            f"★ Recommended: '{winner.get('name', 'Route 1')}' selected as safest option{comparison_text} "
            f"with {wm.get('no_travel_miles', 0)} No Travel miles, {wm.get('severe_miles', 0)} Severe miles, "
            f"and average risk score of {wm.get('average_risk', 0):.2f}."
        )

    return sorted_routes, rationale, all_no_travel_warning
