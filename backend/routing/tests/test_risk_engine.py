import pytest
from routing.services.risk_engine import (
    RiskLevel,
    classify_wind,
    classify_rain,
    classify_snow,
    evaluate_checkpoint_risk,
    calculate_route_metrics,
    rank_routes,
)


class TestRiskClassification:
    def test_wind_thresholds_without_load_escalation(self):
        # <25: Low, 25-34: Moderate, 35-44: High, 45-54: Severe, >=55: No Travel
        assert classify_wind(15.0, load_weight_lbs=20000)[0] == RiskLevel.LOW
        assert classify_wind(24.9, load_weight_lbs=20000)[0] == RiskLevel.LOW
        assert classify_wind(25.0, load_weight_lbs=20000)[0] == RiskLevel.MODERATE
        assert classify_wind(34.0, load_weight_lbs=20000)[0] == RiskLevel.MODERATE
        assert classify_wind(35.0, load_weight_lbs=20000)[0] == RiskLevel.HIGH
        assert classify_wind(44.0, load_weight_lbs=20000)[0] == RiskLevel.HIGH
        assert classify_wind(45.0, load_weight_lbs=20000)[0] == RiskLevel.SEVERE
        assert classify_wind(54.0, load_weight_lbs=20000)[0] == RiskLevel.SEVERE
        assert classify_wind(55.0, load_weight_lbs=20000)[0] == RiskLevel.NO_TRAVEL
        assert classify_wind(65.0, load_weight_lbs=0)[0] == RiskLevel.NO_TRAVEL

    def test_load_escalation_rule_ge_55_any_load(self):
        # >= 55 mph -> No Travel for any load
        level, reason = classify_wind(55.0, load_weight_lbs=0)
        assert level == RiskLevel.NO_TRAVEL
        assert "No Travel" in reason

        level, reason = classify_wind(58.0, load_weight_lbs=45000)
        assert level == RiskLevel.NO_TRAVEL

    def test_load_escalation_rule_45_to_54_with_gt_30k_lb(self):
        # 45–54 mph + >30,000 lb -> No Travel
        # Boundary: 30,000 lb should stay SEVERE (not > 30,000)
        level, reason = classify_wind(48.0, load_weight_lbs=30000)
        assert level == RiskLevel.SEVERE

        # Boundary: 30,001 lb should escalate to NO_TRAVEL
        level, reason = classify_wind(48.0, load_weight_lbs=30001)
        assert level == RiskLevel.NO_TRAVEL
        assert "48" in reason and "30,001" in reason

    def test_load_escalation_rule_35_to_44_with_gt_40k_lb(self):
        # 35–44 mph + >40,000 lb -> Severe
        # Boundary: 40,000 lb should stay HIGH
        level, reason = classify_wind(38.0, load_weight_lbs=40000)
        assert level == RiskLevel.HIGH

        # Boundary: 40,001 lb should escalate to SEVERE
        level, reason = classify_wind(38.0, load_weight_lbs=40001)
        assert level == RiskLevel.SEVERE
        assert "38" in reason and "40,001" in reason

    def test_rain_thresholds(self):
        # <0.10: Low, 0.10–0.25: Moderate, 0.25–0.50: High, 0.50–1.00: Severe, >1.00: No Travel
        assert classify_rain(0.05)[0] == RiskLevel.LOW
        assert classify_rain(0.10)[0] == RiskLevel.MODERATE
        assert classify_rain(0.24)[0] == RiskLevel.MODERATE
        assert classify_rain(0.25)[0] == RiskLevel.HIGH
        assert classify_rain(0.49)[0] == RiskLevel.HIGH
        assert classify_rain(0.50)[0] == RiskLevel.SEVERE
        assert classify_rain(1.00)[0] == RiskLevel.SEVERE
        assert classify_rain(1.01)[0] == RiskLevel.NO_TRAVEL

    def test_snow_thresholds(self):
        # <0.5: Low, 0.5–1.0: Moderate, 1.0–2.0: High, 2.0–3.0: Severe, >3.0: No Travel
        assert classify_snow(0.2)[0] == RiskLevel.LOW
        assert classify_snow(0.5)[0] == RiskLevel.MODERATE
        assert classify_snow(0.99)[0] == RiskLevel.MODERATE
        assert classify_snow(1.0)[0] == RiskLevel.HIGH
        assert classify_snow(1.9)[0] == RiskLevel.HIGH
        assert classify_snow(2.0)[0] == RiskLevel.SEVERE
        assert classify_snow(3.0)[0] == RiskLevel.SEVERE
        assert classify_snow(3.1)[0] == RiskLevel.NO_TRAVEL

    def test_evaluate_checkpoint_risk_worst_case(self):
        # Wind: Moderate (30 mph, 20k lb), Rain: High (0.35 in/hr), Snow: Low (0.1 in/hr)
        # Should pick High (from Rain)
        res = evaluate_checkpoint_risk(
            wind_mph=30.0,
            rain_in_hr=0.35,
            snow_in_hr=0.1,
            load_weight_lbs=20000,
        )
        assert res["level"] == "High"
        assert res["score"] == 3
        assert "Rain" in res["trigger_rule"]

    def test_evaluate_checkpoint_risk_load_rule_dominates(self):
        # Wind: 38 mph + 45k lb -> Severe; Rain: Low; Snow: Low
        res = evaluate_checkpoint_risk(
            wind_mph=38.0,
            rain_in_hr=0.0,
            snow_in_hr=0.0,
            load_weight_lbs=45000,
        )
        assert res["level"] == "Severe"
        assert res["score"] == 4
        assert "Load" in res["trigger_rule"]


class TestRouteMetricsAndRanking:
    def test_calculate_route_metrics_distance_weighted(self):
        # Route of 100 miles with 4 checkpoints (25 miles each)
        checkpoints = [
            {"risk": {"level": "Low", "score": 1}, "segment_miles": 25.0},
            {"risk": {"level": "Moderate", "score": 2}, "segment_miles": 25.0},
            {"risk": {"level": "High", "score": 3}, "segment_miles": 25.0},
            {"risk": {"level": "Severe", "score": 4}, "segment_miles": 25.0},
        ]
        metrics = calculate_route_metrics(checkpoints, total_distance_miles=100.0, duration_hours=2.0)
        assert metrics["low_miles"] == 25.0
        assert metrics["moderate_miles"] == 25.0
        assert metrics["high_miles"] == 25.0
        assert metrics["severe_miles"] == 25.0
        assert metrics["no_travel_miles"] == 0.0
        # (1*25 + 2*25 + 3*25 + 4*25) / 100 = 250 / 100 = 2.5
        assert metrics["average_risk"] == 2.5

    def test_rank_routes_hierarchy(self):
        # Route 1: 0 Severe, 25 High, avg 1.8, 5 hours
        # Route 2: 25 Severe, 0 High, avg 1.9, 4.5 hours (Route 1 wins because fewest Severe miles)
        # Route 3: 0 Severe, 50 High, avg 2.1, 4.8 hours
        r1 = {
            "id": "r1",
            "name": "Route 1",
            "duration_hours": 5.0,
            "risk_metrics": {
                "no_travel_miles": 0.0,
                "severe_miles": 0.0,
                "high_miles": 25.0,
                "average_risk": 1.8,
            },
        }
        r2 = {
            "id": "r2",
            "name": "Route 2",
            "duration_hours": 4.5,
            "risk_metrics": {
                "no_travel_miles": 0.0,
                "severe_miles": 25.0,
                "high_miles": 0.0,
                "average_risk": 1.9,
            },
        }
        r3 = {
            "id": "r3",
            "name": "Route 3",
            "duration_hours": 4.8,
            "risk_metrics": {
                "no_travel_miles": 0.0,
                "severe_miles": 0.0,
                "high_miles": 50.0,
                "average_risk": 2.1,
            },
        }

        ranked, rationale, all_warning = rank_routes([r2, r3, r1])
        assert ranked[0]["id"] == "r1"
        assert ranked[0]["is_recommended"] is True
        assert ranked[1]["id"] == "r3"  # 0 Severe vs 25 Severe on r2
        assert ranked[2]["id"] == "r2"
        assert all_warning is False
        assert "Route 1" in rationale

    def test_rank_routes_no_travel_penalized(self):
        # Route A has 0 Severe miles but 20 No Travel miles!
        # Route B has 10 Severe miles and 0 No Travel miles.
        # Route B must win over Route A!
        rA = {
            "id": "rA",
            "name": "Route A",
            "duration_hours": 4.0,
            "risk_metrics": {
                "no_travel_miles": 20.0,
                "severe_miles": 0.0,
                "high_miles": 0.0,
                "average_risk": 2.5,
            },
        }
        rB = {
            "id": "rB",
            "name": "Route B",
            "duration_hours": 4.5,
            "risk_metrics": {
                "no_travel_miles": 0.0,
                "severe_miles": 10.0,
                "high_miles": 0.0,
                "average_risk": 2.1,
            },
        }
        ranked, rationale, all_warning = rank_routes([rA, rB])
        assert ranked[0]["id"] == "rB"
        assert all_warning is False

    def test_rank_routes_all_no_travel_warning(self):
        # All routes have No Travel miles -> triggers all_warning=True
        r1 = {
            "id": "r1",
            "name": "Route 1",
            "duration_hours": 5.0,
            "risk_metrics": {
                "no_travel_miles": 15.0,
                "severe_miles": 10.0,
                "high_miles": 0.0,
                "average_risk": 3.5,
            },
        }
        r2 = {
            "id": "r2",
            "name": "Route 2",
            "duration_hours": 6.0,
            "risk_metrics": {
                "no_travel_miles": 35.0,
                "severe_miles": 5.0,
                "high_miles": 0.0,
                "average_risk": 3.8,
            },
        }
        ranked, rationale, all_warning = rank_routes([r1, r2])
        assert all_warning is True
        assert "All available routes encounter No Travel conditions" in rationale
