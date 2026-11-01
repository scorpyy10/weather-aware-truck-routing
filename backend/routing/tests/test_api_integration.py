from unittest.mock import patch, MagicMock
from rest_framework.test import APITestCase
from rest_framework import status


class TestRouteApiIntegration(APITestCase):
    @patch("routing.services.weather_service.fetch_batch_weather")
    @patch("routing.services.route_generator.get_three_routes")
    def test_calculate_routes_success(self, mock_get_routes, mock_weather):
        # Mock 3 routes
        mock_get_routes.return_value = [
            {
                "id": "route_1",
                "name": "via I-80 W",
                "distance_meters": 800000.0,
                "distance_miles": 497.1,
                "duration_seconds": 28800.0,
                "duration_hours": 8.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-104.99, 39.73], [-108.0, 40.0], [-111.89, 40.76]],
                },
            },
            {
                "id": "route_2",
                "name": "via I-70 W",
                "distance_meters": 850000.0,
                "distance_miles": 528.1,
                "duration_seconds": 32400.0,
                "duration_hours": 9.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-104.99, 39.73], [-107.5, 39.5], [-111.89, 40.76]],
                },
            },
            {
                "id": "route_3",
                "name": "via US-50 W",
                "distance_meters": 900000.0,
                "distance_miles": 559.2,
                "duration_seconds": 36000.0,
                "duration_hours": 10.0,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[-104.99, 39.73], [-108.5, 38.5], [-111.89, 40.76]],
                },
            },
        ]

        # Mock weather
        mock_weather.return_value = {}

        payload = {
            "origin": {"lat": 39.7392, "lng": -104.9903, "name": "Denver, CO"},
            "destination": {"lat": 40.7608, "lng": -111.8910, "name": "Salt Lake City, UT"},
            "departure_time": "2026-11-01T08:00:00Z",
            "load_weight": 42000,
            "sampling_interval_miles": 25,
        }

        resp = self.client.post("/api/routes/calculate/", payload, format="json")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()

        assert "recommended_route_id" in data
        assert "recommendation_rationale" in data
        assert "routes" in data
        assert len(data["routes"]) == 3
        assert "corridor_heatmap" in data
        assert len(data["corridor_heatmap"]["hours"]) == 49

        # Verify route 1 properties
        r1 = data["routes"][0]
        assert "risk_metrics" in r1
        assert "checkpoints" in r1
        assert len(r1["checkpoints"]) > 0
        cp = r1["checkpoints"][0]
        assert "weather" in cp
        assert "risk" in cp
        assert "hourly_risk_scores" in cp
        assert len(cp["hourly_risk_scores"]) == 49

    def test_calculate_routes_validation_errors(self):
        # Test negative load weight
        payload = {
            "origin": {"lat": 39.7392, "lng": -104.9903},
            "destination": {"lat": 40.7608, "lng": -111.8910},
            "load_weight": -500,
            "sampling_interval_miles": 25,
        }
        resp = self.client.post("/api/routes/calculate/", payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

        # Test invalid sampling interval (e.g. 15 miles)
        payload["load_weight"] = 30000
        payload["sampling_interval_miles"] = 15
        resp = self.client.post("/api/routes/calculate/", payload, format="json")
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @patch("routing.views.requests.get")
    def test_geocoding_search_proxy(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "features": [
                {
                    "geometry": {"coordinates": [-104.9903, 39.7392]},
                    "properties": {
                        "name": "Denver",
                        "state": "Colorado",
                        "country": "United States",
                    },
                }
            ]
        }
        mock_get.return_value = mock_resp

        resp = self.client.get("/api/geocoding/search/?q=Denver")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) >= 1
        assert "Denver" in data[0]["name"]
        assert data[0]["lat"] == 39.7392
        assert data[0]["lng"] == -104.9903

    @patch("routing.views.requests.get")
    def test_geocoding_nominatim_fallback(self, mock_get):
        # First call (Photon) returns 500 error; second call (Nominatim) returns results
        mock_photon_fail = MagicMock()
        mock_photon_fail.status_code = 500

        mock_nom_success = MagicMock()
        mock_nom_success.status_code = 200
        mock_nom_success.json.return_value = [
            {
                "display_name": "Dallas, Dallas County, Texas, United States",
                "lat": "32.7767",
                "lon": "-96.7970",
            }
        ]
        mock_get.side_effect = [mock_photon_fail, mock_nom_success]

        resp = self.client.get("/api/geocoding/search/?q=Dallas")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) >= 1
        assert "Dallas" in data[0]["name"]
        assert data[0]["lat"] == 32.7767
        assert data[0]["lng"] == -96.7970

    @patch("routing.views.requests.get", side_effect=Exception("Network down"))
    def test_geocoding_offline_hub_fallback(self, mock_get):
        # Both APIs fail, should fallback to MAJOR_US_FREIGHT_HUBS matching query
        resp = self.client.get("/api/geocoding/search/?q=Chicago")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert len(data) >= 1
        assert any("Chicago" in item["name"] for item in data)
