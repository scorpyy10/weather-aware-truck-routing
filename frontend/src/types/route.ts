export type RiskLevelName = 'Low' | 'Moderate' | 'High' | 'Severe' | 'No Travel';

export interface LocationPoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface WeatherCondition {
  wind_speed_mph: number;
  rain_in_per_hr: number;
  snow_in_per_hr: number;
  temp_f: number;
  condition: string;
}

export interface HazardDetail {
  level: RiskLevelName;
  score: number;
  reason: string;
}

export interface RiskEvaluation {
  level: RiskLevelName;
  score: number;
  trigger_rule: string;
  hazards?: {
    wind: HazardDetail;
    rain: HazardDetail;
    snow: HazardDetail;
  };
}

export interface Checkpoint {
  index: number;
  distance_from_start_miles: number;
  segment_miles: number;
  location: LocationPoint;
  eta: string;
  weather: WeatherCondition;
  risk: RiskEvaluation;
  hourly_risk_scores: number[];
}

export interface RiskMetrics {
  total_distance_miles: number;
  duration_hours: number;
  no_travel_miles: number;
  severe_miles: number;
  high_miles: number;
  moderate_miles: number;
  low_miles: number;
  average_risk: number;
}

export interface RouteOption {
  id: string;
  name: string;
  is_recommended: boolean;
  rank: number;
  distance_miles: number;
  duration_hours: number;
  risk_metrics: RiskMetrics;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  checkpoints: Checkpoint[];
}

export interface HeatmapGridPoint {
  lat: number;
  lng: number;
  intensity: number; // 0.0 to 1.0
  risk_level: RiskLevelName;
}

export interface HeatmapHour {
  hour_offset: number;
  timestamp: string;
  grid_points: HeatmapGridPoint[];
}

export interface CorridorHeatmap {
  bounds: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
  hours: HeatmapHour[];
}

export interface RouteCalculationResponse {
  recommended_route_id: string;
  recommendation_rationale: string;
  all_no_travel_warning: boolean;
  routes: RouteOption[];
  corridor_heatmap: CorridorHeatmap;
}

export interface RouteCalculationRequest {
  origin: LocationPoint;
  destination: LocationPoint;
  departure_time: string;
  load_weight: number;
  sampling_interval_miles: number;
}
