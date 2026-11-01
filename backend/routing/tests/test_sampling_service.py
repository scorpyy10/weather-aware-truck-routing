from datetime import datetime, timezone
import pytest
from routing.services.sampling_service import (
    haversine_distance_miles,
    sample_route_checkpoints,
)


class TestSamplingService:
    def test_haversine_distance_calculation(self):
        # Distance between Denver (39.7392, -104.9903) and Boulder (40.0150, -105.2705) is ~24.5 miles
        dist = haversine_distance_miles(39.7392, -104.9903, 40.0150, -105.2705)
        assert 24.0 <= dist <= 25.5

    def test_sampling_intervals_25_miles(self):
        # Synthetic 100-mile straight north line from (40.0, -105.0)
        # 1 deg latitude is ~69 miles, so 100 miles is ~1.449 degrees
        coords = [
            [-105.0, 40.0],
            [-105.0, 40.7245],
            [-105.0, 41.449],
        ]
        dep_time = "2026-11-01T08:00:00Z"
        # Total distance ~100 miles (160,934 meters), baseline car duration 1.5 hours (5400s)
        checkpoints = sample_route_checkpoints(
            coordinates=coords,
            total_distance_meters=160934.0,
            total_duration_seconds=5400.0,
            departure_time_iso=dep_time,
            sampling_interval_miles=25.0,
            truck_speed_adjustment_factor=1.15,
        )

        assert len(checkpoints) >= 4
        # First checkpoint at start
        assert checkpoints[0]["distance_from_start_miles"] == 0.0
        assert checkpoints[0]["eta"] == "2026-11-01T08:00:00Z"

        # Check spacing ~25 miles
        for i in range(1, len(checkpoints)):
            assert checkpoints[i]["distance_from_start_miles"] > checkpoints[i - 1]["distance_from_start_miles"]
            assert checkpoints[i]["segment_miles"] > 0

        # Last checkpoint reaches total distance
        last_cp = checkpoints[-1]
        assert 98.0 <= last_cp["distance_from_start_miles"] <= 101.0

        # Total calibrated duration is 5400 * 1.15 = 6210 seconds = 103.5 minutes
        # Arrival at last checkpoint should be 08:00:00 + 103.5m = 09:43:30
        last_eta = datetime.fromisoformat(last_cp["eta"].replace("Z", "+00:00"))
        start_eta = datetime.fromisoformat(dep_time.replace("Z", "+00:00"))
        duration_mins = (last_eta - start_eta).total_seconds() / 60.0
        assert 100.0 <= duration_mins <= 105.0

    def test_short_route_under_interval(self):
        # 15 miles route with 25 mile interval should produce 2 checkpoints (start and finish)
        coords = [
            [-105.0, 40.0],
            [-105.0, 40.217],
        ]
        dep_time = "2026-11-01T08:00:00Z"
        checkpoints = sample_route_checkpoints(
            coordinates=coords,
            total_distance_meters=24140.0,  # ~15 miles
            total_duration_seconds=900.0,
            departure_time_iso=dep_time,
            sampling_interval_miles=25.0,
            truck_speed_adjustment_factor=1.15,
        )
        assert len(checkpoints) == 2
        assert checkpoints[0]["distance_from_start_miles"] == 0.0
        assert 14.5 <= checkpoints[1]["distance_from_start_miles"] <= 15.5
        assert checkpoints[0]["segment_miles"] + checkpoints[1]["segment_miles"] >= 14.5

    def test_sampling_intervals_10_and_50(self):
        coords = [
            [-105.0, 40.0],
            [-105.0, 40.7245],
            [-105.0, 41.449],
        ]
        dep_time = "2026-11-01T08:00:00Z"
        cp_10 = sample_route_checkpoints(
            coords, 160934.0, 5400.0, dep_time, sampling_interval_miles=10.0
        )
        cp_50 = sample_route_checkpoints(
            coords, 160934.0, 5400.0, dep_time, sampling_interval_miles=50.0
        )
        assert len(cp_10) > len(cp_50)
        assert len(cp_50) >= 3  # 0, 50, 100
        assert len(cp_10) >= 10  # 0, 10, 20...
