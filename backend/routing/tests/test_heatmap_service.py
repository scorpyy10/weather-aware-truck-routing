from routing.services.heatmap_service import generate_corridor_heatmap_data


class TestHeatmapService:
    def test_generate_corridor_heatmap_data(self):
        # 2 checkpoints with 49 hourly risk scores each
        routes_checkpoints = [
            [
                {
                    "location": {"lat": 40.0, "lng": -105.0},
                    "hourly_risk_scores": [1] * 49,
                },
                {
                    "location": {"lat": 41.0, "lng": -104.0},
                    "hourly_risk_scores": [4] * 49,
                },
            ]
        ]

        heatmap = generate_corridor_heatmap_data(
            routes_checkpoints=routes_checkpoints,
            departure_time_iso="2026-11-01T08:00:00Z",
            num_hours=49,
        )

        assert "bounds" in heatmap
        assert "hours" in heatmap
        assert len(heatmap["hours"]) == 49
        assert heatmap["hours"][0]["hour_offset"] == 0
        assert heatmap["hours"][48]["hour_offset"] == 48

        # Check points for hour 0
        h0_pts = heatmap["hours"][0]["grid_points"]
        assert len(h0_pts) == 2
        # Checkpoint 1: score 1 -> intensity 1/5 = 0.2
        # Checkpoint 2: score 4 -> intensity 4/5 = 0.8
        assert h0_pts[0]["intensity"] == 0.2
        assert h0_pts[0]["risk_level"] == "Low"
        assert h0_pts[1]["intensity"] == 0.8
        assert h0_pts[1]["risk_level"] == "Severe"
