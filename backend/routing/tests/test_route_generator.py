from unittest.mock import patch, MagicMock
import pytest
from routing.services.route_generator import (
    get_three_routes,
    compute_lateral_waypoint,
    format_route_name,
)


class TestRouteGenerator:
    def test_compute_lateral_waypoint(self):
        # Origin: (40.0, -105.0), Dest: (40.0, -100.0) -> Due East
        # Perpendicular should shift North or South
        wp_north = compute_lateral_waypoint((40.0, -105.0), (40.0, -100.0), offset_ratio=0.2, direction=1)
        wp_south = compute_lateral_waypoint((40.0, -105.0), (40.0, -100.0), offset_ratio=0.2, direction=-1)

        # Midpoint is (40.0, -102.5)
        assert abs(wp_north[1] - (-102.5)) < 0.2
        assert wp_north[0] > 40.0  # shifted north
        assert wp_south[0] < 40.0  # shifted south

    @patch("routing.services.route_generator.requests.get")
    def test_get_three_routes_when_osrm_returns_three_routes(self, mock_get):
        # Mock OSRM returning 3 routes
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "code": "Ok",
            "routes": [
                {
                    "distance": 800000.0,
                    "duration": 28800.0,
                    "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-108.0, 40.0], [-111.89, 40.76]]},
                    "legs": [{"summary": "I-80 W"}],
                },
                {
                    "distance": 850000.0,
                    "duration": 31000.0,
                    "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-107.5, 39.5], [-111.89, 40.76]]},
                    "legs": [{"summary": "I-70 W"}],
                },
                {
                    "distance": 900000.0,
                    "duration": 34000.0,
                    "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-108.5, 38.5], [-111.89, 40.76]]},
                    "legs": [{"summary": "US-50 W"}],
                },
            ],
        }
        mock_get.return_value = mock_resp

        routes = get_three_routes((39.7392, -104.9903), (40.7608, -111.8910))
        assert len(routes) == 3
        assert routes[0]["id"] == "route_1"
        assert routes[1]["id"] == "route_2"
        assert routes[2]["id"] == "route_3"
        assert routes[0]["distance_miles"] > 0
        assert routes[0]["duration_hours"] > 0
        assert routes[0]["geometry"]["type"] == "LineString"

    @patch("routing.services.route_generator.requests.get")
    def test_get_three_routes_when_osrm_returns_single_route(self, mock_get):
        # Mock OSRM returning 1 route on initial call, and 1 route for each waypoint fallback call
        def side_effect(url, **kwargs):
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            # If waypoint in url
            if ";" in url and url.count(";") == 2:
                mock_resp.json.return_value = {
                    "code": "Ok",
                    "routes": [
                        {
                            "distance": 860000.0,
                            "duration": 32000.0,
                            "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-107.0, 41.5], [-111.89, 40.76]]},
                            "legs": [{"summary": "via Alternate Waypoint"}],
                        }
                    ],
                }
            else:
                mock_resp.json.return_value = {
                    "code": "Ok",
                    "routes": [
                        {
                            "distance": 800000.0,
                            "duration": 28800.0,
                            "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-111.89, 40.76]]},
                            "legs": [{"summary": "I-80 W"}],
                        }
                    ],
                }
            return mock_resp

        mock_get.side_effect = side_effect

        routes = get_three_routes((39.7392, -104.9903), (40.7608, -111.8910))
        assert len(routes) == 3
        # Should guarantee 3 routes even when initial OSRM query only returned 1
        assert routes[0]["id"] == "route_1"
        assert routes[1]["id"] == "route_2"
        assert routes[2]["id"] == "route_3"

    @patch("routing.services.route_generator.requests.get")
    def test_get_three_routes_network_fallback(self, mock_get):
        # When external routing API fails completely, fallback synthesizes 3 corridors without crashing
        mock_get.side_effect = Exception("OSRM connection timeout")

        routes = get_three_routes((39.7392, -104.9903), (40.7608, -111.8910))
        assert len(routes) == 3
        for r in routes:
            assert r["geometry"]["type"] == "LineString"
            assert len(r["geometry"]["coordinates"]) >= 2
            assert r["distance_miles"] > 0
            assert r["duration_hours"] > 0

    @patch("routing.services.route_generator.requests.get")
    def test_get_three_routes_deduplication(self, mock_get):
        # When initial route and first curated route return identical distance (duplicate)
        call_count = 0
        def side_effect(url, **kwargs):
            nonlocal call_count
            call_count += 1
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            # First call and second call return identical 800,000m path
            if call_count <= 2:
                mock_resp.json.return_value = {
                    "code": "Ok",
                    "routes": [{
                        "distance": 800000.0,
                        "duration": 28800.0,
                        "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-111.89, 40.76]]},
                        "legs": [{"summary": "I-80 W"}],
                    }],
                }
            else:
                mock_resp.json.return_value = {
                    "code": "Ok",
                    "routes": [{
                        "distance": 850000.0 + (call_count * 10000),
                        "duration": 31000.0,
                        "geometry": {"type": "LineString", "coordinates": [[-104.99, 39.73], [-108.0, 39.0], [-111.89, 40.76]]},
                        "legs": [{"summary": f"Alternative {call_count}"}],
                    }],
                }
            return mock_resp

        mock_get.side_effect = side_effect
        routes = get_three_routes((39.7392, -104.9903), (40.7608, -111.8910))
        assert len(routes) == 3
        # Distances must all be distinct (no duplicate 800,000m routes)
        distances = [r["distance_meters"] for r in routes]
        assert len(set(distances)) == 3
