from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
import pytest
from routing.services.weather_service import (
    fetch_batch_weather,
    extract_weather_at_timestamp,
    generate_hourly_risk_series,
    weather_code_to_condition,
)


class TestWeatherService:
    def test_weather_code_mapping(self):
        assert weather_code_to_condition(0) == "Clear sky"
        assert "Rain" in weather_code_to_condition(63)
        assert "Snow" in weather_code_to_condition(73)
        assert "Thunderstorm" in weather_code_to_condition(95)

    @patch("routing.services.weather_service.requests.get")
    def test_fetch_batch_weather_mocked(self, mock_get):
        # Open-Meteo returns list of dicts when batching
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {
                "latitude": 40.0,
                "longitude": -105.0,
                "hourly": {
                    "time": ["2026-11-01T08:00", "2026-11-01T09:00", "2026-11-01T10:00"],
                    "wind_speed_10m": [22.0, 38.0, 56.0],
                    "rain": [0.0, 0.3, 0.0],
                    "snowfall": [0.0, 0.0, 1.5],
                    "temperature_2m": [45.0, 42.0, 30.0],
                    "weather_code": [1, 61, 71],
                },
            }
        ]
        mock_get.return_value = mock_resp

        weather_map = fetch_batch_weather(
            [(40.0, -105.0)],
            departure_time_iso="2026-11-01T08:00:00Z",
        )
        assert (40.0, -105.0) in weather_map
        series = weather_map[(40.0, -105.0)]
        assert len(series["time"]) == 3

    def test_extract_weather_at_timestamp(self):
        series = {
            "time": ["2026-11-01T08:00", "2026-11-01T09:00", "2026-11-01T10:00"],
            "wind_speed_10m": [20.0, 35.0, 50.0],
            "rain": [0.0, 0.4, 0.0],
            "snowfall": [0.0, 0.0, 1.2],
            "temperature_2m": [50.0, 44.0, 32.0],
            "weather_code": [0, 61, 71],
        }
        # Arrival at 09:25 should match 09:00 slot
        w = extract_weather_at_timestamp(series, "2026-11-01T09:25:00Z")
        assert w["wind_speed_mph"] == 35.0
        assert w["rain_in_per_hr"] == 0.4
        assert w["snow_in_per_hr"] == 0.0
        assert w["temp_f"] == 44.0

    def test_generate_hourly_risk_series(self):
        # 49 hours of data
        times = [f"2026-11-01T{h:02d}:00" for h in range(24)] + [f"2026-11-02T{h:02d}:00" for h in range(24)] + ["2026-11-03T00:00"]
        # Hour 0: wind 20, load 45k -> Low (score 1)
        # Hour 5: wind 38, load 45k (>40k) -> Severe (score 4)
        # Hour 10: wind 56 -> No Travel (score 5)
        winds = [20.0] * 49
        winds[5] = 38.0
        winds[10] = 56.0

        series = {
            "time": times,
            "wind_speed_10m": winds,
            "rain": [0.0] * 49,
            "snowfall": [0.0] * 49,
            "temperature_2m": [50.0] * 49,
            "weather_code": [0] * 49,
        }

        scores = generate_hourly_risk_series(
            series,
            departure_time_iso="2026-11-01T00:00:00Z",
            load_weight_lbs=45000,
            num_hours=49,
        )
        assert len(scores) == 49
        assert scores[0] == 1
        assert scores[5] == 4  # Load rule 35-44 + >40k -> Severe
        assert scores[10] == 5  # >=55 -> No Travel
