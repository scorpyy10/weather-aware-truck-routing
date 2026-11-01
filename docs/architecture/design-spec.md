# Weather-Aware Truck Routing — Architecture Design & Decision Record (ADR)

**Date**: 2026-10-31  
**Project**: Weather-Aware Truck Routing System  
**Reference Document**: [fs-assessment-spotter.pdf](file:///Users/yashpatel/Desktop/Weather-Aware%20Truck%20Routing/fs-assessment-spotter.pdf)  
**Status**: Approved for Planning  

---

## 1. Executive Summary & Intent

Long-haul commercial truck operations face significant safety hazards, cargo loss risks, and costly delays due to severe weather events (high crosswinds causing blow-overs, heavy rain causing hydroplaning, and mountain snowpack causing spin-outs).

This application is a production-grade, full-stack decision-support system built for commercial truck drivers and dispatchers. It ingests origin, destination, planned departure time, and cargo payload weight to:
1. Generate **three alternative highway routes**.
2. Sample granular weather along each route at **10, 25, or 50-mile intervals** based on the vehicle's dynamic **estimated arrival time (ETA)** at each checkpoint.
3. Compute weather risk per checkpoint against specific **wind, rain, and snow thresholds**, incorporating **vehicle payload escalation rules**.
4. Recommend the **safest route** using a transparent lexicographical hierarchy balancing risk mitigation and transit duration.
5. Provide a hardware-accelerated, interactive map visualizing route polylines, checkpoint hazards, risk summaries, and a **0–48 hour forecast slider** with a dynamic corridor risk heatmap.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Mathematical Correctness (40% rubric weight)**: Exact implementation of the assessment's risk rules, load escalation triggers, checkpoint segment attribution, and lexicographical recommendation sorting.
- **UI & Performance Excellence (40% rubric weight)**: 60fps WebGL map rendering via MapLibre GL JS, ultra-smooth 0–48h timeline scrubbing, timeline animation playback, and high-contrast dark freight UI.
- **Zero API-Key Dependency**: Functional out-of-the-box for evaluators without requiring credit card setups or paid third-party tokens (using Open-Meteo, OSRM, and Photon/OSM).
- **Production Code Quality (15% rubric weight)**: Clean separation of concerns in Django REST Framework (DRF), dataclass-driven typing, comprehensive unit tests, and production-ready Docker/WhiteNoise packaging.
- **Evaluation Transparency (5% rubric weight)**: Decision rationale badges explaining precisely *why* the winning route was recommended over the alternatives.

### Non-Goals
- Real-time GPS vehicle tracking during transit.
- Turn-by-turn spoken audio navigation.
- Fuel cost optimization or toll avoidance calculations.
- Native mobile app deployment (focus is responsive web dashboard).

### Anti-Goals
- **No Paid API Barriers**: Do not require evaluators or reviewers to register for Mapbox or OpenWeatherMap API keys before being able to run and verify the project.
- **No Opaque AI Scoring**: Do not use "black box" heuristics or arbitrary machine learning models for risk scoring; risk classifications must strictly match the deterministic rules in the specification.
- **No Unsafe Recommendations**: Never recommend a route containing "No Travel" checkpoints if any alternative route is free of "No Travel" conditions.

---

## 3. Architecture & Technical Approaches

### Approaches Considered

#### Approach 1: Decoupled Full-Stack Engine (Selected)
- **Backend**: Django REST Framework backend with modular domain services (`routing_service`, `weather_service`, `risk_engine`, `heatmap_service`).
- **Frontend**: Vite + React SPA with TypeScript, Tailwind CSS, Lucide icons, and MapLibre GL JS.
- **Production Delivery**: Single container or server deployment where Django WhiteNoise serves the compiled React static bundle, eliminating CORS hurdles.
- **Why chosen**: Delivers the exact React + Django requirement, provides dedicated 60fps WebGL rendering for the 40% UI smoothness rubric, cleanly isolates the 40% backend risk logic for automated testing, and runs friction-free without API key gates.

#### Approach 2: Monolithic Django Templates with HTMX & Leaflet (Rejected)
- Relies on server-rendered templates with partial DOM replacement.
- **Why rejected**: Lacks fluid 60fps timeline scrubbing for the 48-hour heatmap and checkpoint animation; DOM/Canvas swapping produces noticeable stutter during timeline playback.

#### Approach 3: Fully Independent Microservices with Separate Cloud Hosts (Rejected)
- Standalone React frontend (Vercel) and standalone DRF backend (Render/Railway).
- **Why rejected**: Introduces unnecessary CORS configuration, cross-site cookie hurdles, and multi-repository/multi-service deployment maintenance for evaluators.

---

## 4. Key Architectural & Business Decisions (ADR)

### Decision 1: Multi-Hazard Aggregation & "No Travel" Policy
- **Decision**: Checkpoint composite risk level is calculated via the worst-case principle:
  $$\text{Risk}_{\text{checkpoint}} = \max(\text{Risk}_{\text{wind}}, \text{Risk}_{\text{rain}}, \text{Risk}_{\text{snow}})$$
  Where wind risk incorporates the cargo payload escalation rules.
- **No Travel Rule**: Any route with one or more checkpoints classified as `No Travel` is flagged as unsafe and assigned the lowest recommendation priority. If all 3 routes encounter `No Travel`, a prominent safety warning banner is displayed advising the driver to postpone departure.
- **Why**: Truck safety is dictated by the weakest link; a truck cannot safely navigate severe snowfall even if winds are low. Disqualifying or penalizing `No Travel` routes guarantees driver safety.

### Decision 2: Guaranteed 3 Alternative Routes via Dynamic Waypoint Fallback
- **Decision**: Query the routing engine for up to 3 alternatives (`alternatives=true`). If the routing engine returns fewer than 3 natural routes (common along singular interstate corridors like I-80 or I-70), `route_generator.py` applies a robust two-tier fallback:
  1. **Curated Freight Corridors**: For standard regional freight paths (e.g. Northern I-80 vs Central I-70 vs Southern I-40), use established interstate junction waypoints to guarantee realistic commercial highway alternatives.
  2. **Geometric Lateral Waypoint Synthesis**: For arbitrary origin-destination pairs, compute midpoint lateral offsets snapped to major road coordinates, ensuring valid routes without sending trucks onto non-truckable paths.
- **Why**: Public routing engines frequently return only 1 or 2 routes between specific city pairs. Dynamic waypoint fallback guarantees compliance with Requirement 2 ("Generate 3 route options") under all geographic conditions.

### Decision 3: Segment-Interval Mileage Attribution & Distance-Weighted Average Risk
- **Decision**: 
  - Each checkpoint represents its surrounding distance interval (e.g. 25 miles).
  - Severe miles and High miles are calculated as the sum of segment lengths classified at those respective severity tiers:
    $$\text{Severe Miles} = \sum_{i \in \text{Severe}} \Delta d_i, \quad \text{High Miles} = \sum_{i \in \text{High}} \Delta d_i$$
  - Average Risk is computed as the distance-weighted mean:
    $$\text{Average Risk} = \frac{\sum_{i=1}^N (\text{Score}_i \times \Delta d_i)}{\sum_{i=1}^N \Delta d_i}$$
    Using numerical severity scores: $\text{Low} = 1$, $\text{Moderate} = 2$, $\text{High} = 3$, $\text{Severe} = 4$, $\text{No Travel} = 5$.
- **Why**: Simple unweighted checkpoint counts skew risk when route boundaries or segment lengths vary. Distance-weighted metrics accurately reflect the physical exposure of the freight to hazards.

### Decision 4: Open-Meteo Weather API with Backend Batching & Memory Caching
- **Decision**: Use Open-Meteo's hourly forecast API (`/v1/forecast`), executing bulk queries that pass multiple coordinates (`latitude=lat1,lat2,...&longitude=lon1,lon2,...`) in single HTTP requests. Cache weather responses using Django's in-memory cache keyed by spatial grid and hourly epoch.
- **Why**: Sampling every 10 miles on 3 routes generates 150–200 checkpoints. Individual API requests would cause 15–30s latency and trigger 429 rate limits. Open-Meteo's bulk API completes in <1.5s, requires zero API keys, and provides exact wind speed, rain rate, and snowfall rate.

### Decision 5: MapLibre GL JS with Hardware-Accelerated WebGL
- **Decision**: Use MapLibre GL JS on the frontend with free vector tiles (Carto / OpenFreeMap). Render route polylines, checkpoint markers, and the corridor weather heatmap using WebGL layers.
- **Why**: Satisfies the 40% UI & smoothness evaluation rubric. WebGL hardware acceleration ensures 60fps scrubbing on the 0–48h timeline slider without DOM thrashing or Canvas lag.

### Decision 6: Calibrated Commercial Truck Speed Profile
- **Decision**: Scale passenger car routing durations by a calibrated factor of 1.15x (capped at 60–65 mph highway speeds) to compute realistic commercial truck checkpoint arrival times (ETAs).
- **Why**: Heavy Class 8 trucks are speed-governed and cannot travel at passenger car speeds. Calibrated ETAs ensure weather conditions are sampled at the exact hour the truck will physically be at that checkpoint.

### Decision 7: Cargo Payload Definition & Form Presets
- **Decision**: "Load weight" is defined as cargo payload weight ranging from 0 to 80,000 lbs. The UI provides quick-select presets:
  - Empty: `0 lb`
  - Partial: `25,000 lb`
  - Full / Heavy: `45,000 lb`
- **Why**: Allows instant verification of the load escalation thresholds ($>30\text{,}000\text{ lb}$ and $>40\text{,}000\text{ lb}$) during evaluation without requiring manual typing.

### Decision 8: Transparent Lexicographical Recommendation Rationale
- **Decision**: Sort routes using a strict 5-element tuple:
  $$\text{SortKey} = (\text{NoTravelMiles}, \text{SevereMiles}, \text{HighMiles}, \text{AverageRisk}, \text{DurationSeconds})$$
  The UI renders a dedicated "Decision Rationale" card explicitly detailing why the winning route was selected over each alternative (e.g., *"Selected: 0 Severe miles vs 35 miles on Route 2; 28 min faster than Route 3"*).
- **Why**: Eliminates ambiguity and gives evaluators direct visibility into how the recommendation algorithm prioritizes safety over speed.

### Decision 9: Keyless Geocoding Autocomplete & Pre-configured Freight Corridors
- **Decision**: Integrate Photon geocoding (OpenStreetMap-backed) with a 300ms debounce for address/city autocomplete, complemented by 1-click test corridor presets:
  - **I-70 Mountain Pass**: Denver, CO $\to$ Salt Lake City, UT (tests snow and high-altitude winds).
  - **I-80 High Wind Corridor**: Cheyenne, WY $\to$ Omaha, NE (tests blow-over wind thresholds and load rules).
  - **I-65 Freight Route**: Chicago, IL $\to$ Atlanta, GA (tests rain, moderate wind, and route alternatives).
- **Why**: Guarantees zero-friction live demonstrations and testing of all edge cases without requiring API credentials.

### Decision 10: Dual-Mode Corridor Heatmap & 48-Hour Timeline Player
- **Decision**: 
  - **Timeline Slider**: Controls forecast hour offset ($T + 0\text{h}$ to $T + 48\text{h}$).
  - **Zero-Latency Data Pipeline**: Open-Meteo returns 48-hour hourly weather for each checkpoint in the primary batch query. The backend computes the primary checkpoint risk at the truck's actual journey ETA, and packs a compact 49-element array `hourly_risk_scores: [int, ...]` (where 1=Low to 5=No Travel) into each checkpoint.
  - **Corridor Heatmap Generation**: The corridor heatmap layer uses the sampled checkpoint coordinates along the route corridor as spatial grid nodes, with intensity calculated as $\text{CompositeRiskScore} / 5.0$. This eliminates redundant external API queries, keeps backend response times under ~1.5s, and maintains full load-weighted risk consistency.
  - **Interactive Experience**: 
    - At Slider = 0 (or "Journey ETA" view), routes and checkpoints show the conditions expected at the truck's physical arrival time.
    - When scrubbing hours 0..48, the WebGL heatmap surface smoothly morphs, and route segment lines/checkpoints dynamically recolor using their `hourly_risk_scores`.
    - Includes Play/Pause animation controls at 1x and 2x speeds.
- **Why**: Directly satisfies Requirement 9 and achieves 60fps hardware-accelerated timeline scrubbing without heavy data serialization overhead.

---

## 5. Detailed System Architecture

### 5.1 Backend Service Structure (`backend/`)
```
backend/
├── manage.py
├── core/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── routing/
    ├── services/
    │   ├── geocoding_service.py     # Photon geocoding client
    │   ├── route_generator.py       # OSRM client + dynamic waypoint fallback
    │   ├── weather_service.py       # Open-Meteo batch requester + cache
    │   ├── risk_engine.py           # Threshold rules, load rules, ranking
    │   └── heatmap_service.py       # Corridor grid generation (0-48h)
    ├── views.py                     # API endpoints
    ├── serializers.py               # Input validation & response schemas
    └── tests/
        ├── test_risk_engine.py      # Threshold & load rule unit tests
        ├── test_route_ranking.py    # Lexicographical tie-breaking tests
        └── test_sampling.py         # Checkpoint spacing & ETA calculation tests
```

### 5.2 API Specifications

#### `POST /api/routes/calculate/`
**Request Payload**:
```json
{
  "origin": {"lat": 39.7392, "lng": -104.9903, "name": "Denver, CO"},
  "destination": {"lat": 40.7608, "lng": -111.8910, "name": "Salt Lake City, UT"},
  "departure_time": "2026-11-01T08:00:00Z",
  "load_weight": 42000,
  "sampling_interval_miles": 25
}
```

**Response Payload**:
```json
{
  "recommended_route_id": "route_1",
  "recommendation_rationale": "Safest route: 0 No Travel miles, 0 Severe miles, and 1.32 avg risk vs 45 Severe miles on Route 2.",
  "all_no_travel_warning": false,
  "routes": [
    {
      "id": "route_1",
      "name": "via I-80 W",
      "is_recommended": true,
      "distance_miles": 535.2,
      "duration_hours": 9.4,
      "risk_metrics": {
        "no_travel_miles": 0.0,
        "severe_miles": 0.0,
        "high_miles": 25.0,
        "moderate_miles": 75.0,
        "low_miles": 435.2,
        "average_risk": 1.32
      },
      "geometry": { "type": "LineString", "coordinates": [...] },
      "checkpoints": [
        {
          "index": 0,
          "distance_from_start_miles": 25.0,
          "location": {"lat": 40.1, "lng": -105.2},
          "eta": "2026-11-01T08:26:00Z",
          "weather": {
            "wind_speed_mph": 38.0,
            "rain_in_per_hr": 0.0,
            "snow_in_per_hr": 0.0,
            "temp_f": 42.0,
            "condition": "Breezy"
          },
          "risk": {
            "level": "Severe",
            "score": 4,
            "trigger_rule": "Wind 38 mph + Load 42,000 lb (>40,000 lb) -> Severe"
          },
          "hourly_risk_scores": [1, 1, 2, 2, 3, 4, 4, 3, 2, 1, 1]
        }
      ]
    }
  ],
  "corridor_heatmap": {
    "bounds": [[-112.5, 39.2], [-104.2, 41.8]],
    "hours": [
      {
        "hour_offset": 0,
        "timestamp": "2026-11-01T08:00:00Z",
        "grid_points": [
          {"lat": 40.1, "lng": -105.2, "intensity": 0.8, "risk_level": "Severe"}
        ]
      }
    ]
  }
}
```

#### `GET /api/geocoding/search/?q={query}`
Returns autocomplete suggestions powered by Photon.

---

### 5.3 Frontend Component Hierarchy (`frontend/`)
```
frontend/
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── TruckMap.tsx          # MapLibre container & WebGL source setup
│   │   │   ├── RouteLayers.tsx       # Polylines for 3 routes with risk colors
│   │   │   ├── CheckpointMarkers.tsx # Interactive checkpoint pins & popups
│   │   │   └── HeatmapLayer.tsx      # Interpolated corridor risk surface
│   │   ├── Controls/
│   │   │   ├── RouteSearchForm.tsx   # Origin/dest autocomplete, time, load presets
│   │   │   ├── CorridorPresets.tsx   # 1-click test scenario buttons
│   │   │   └── IntervalSelector.tsx  # 10 / 25 / 50 mile buttons
│   │   ├── Timeline/
│   │   │   └── ForecastSlider.tsx    # 0-48h slider with Play/Pause animation
│   │   └── Dashboard/
│   │       ├── RouteSummaryCard.tsx  # Route cards with Severe/High badges
│   │       ├── RationaleBanner.tsx   # Recommendation explanation card
│   │       └── CheckpointDetailModal.tsx # Deep inspection drawer
│   ├── hooks/
│   │   ├── useRouteCalculation.ts
│   │   └── useTimelinePlayer.ts
│   └── types/
│       └── route.ts
```

---

## 6. Risk Engine Rules Specification

### Threshold Rules
| Hazard Condition | Low ($1$) | Moderate ($2$) | High ($3$) | Severe ($4$) | No Travel ($5$) |
|---|---|---|---|---|---|
| **Wind Speed** | $<25\text{ mph}$ | $25–34\text{ mph}$ | $35–44\text{ mph}$ | $45–54\text{ mph}$ | $\ge 55\text{ mph}$ |
| **Rain Rate** | $<0.10\text{ in/hr}$ | $0.10–0.25\text{ in/hr}$ | $0.25–0.50\text{ in/hr}$ | $0.50–1.00\text{ in/hr}$ | $>1.00\text{ in/hr}$ |
| **Snowfall Rate** | $<0.5\text{ in/hr}$ | $0.5–1.0\text{ in/hr}$ | $1.0–2.0\text{ in/hr}$ | $2.0–3.0\text{ in/hr}$ | $>3.0\text{ in/hr}$ |

### Load Weight Escalation Rules
1. **$\ge 55\text{ mph}$ wind**: Classify as **No Travel** for any load weight.
2. **$45–54\text{ mph}$ wind AND load $>30\text{,}000\text{ lb}$**: Escalate from Severe to **No Travel**.
3. **$35–44\text{ mph}$ wind AND load $>40\text{,}000\text{ lb}$**: Escalate from High to **Severe**.

### Composite Risk Level
$$\text{Level} = \max(\text{WindWithLoadRule}, \text{RainRule}, \text{SnowRule})$$

---

## 7. What is Left to the Builder

The builder has full autonomy over:
- Internal helper utility organization (e.g. geometric distance calculations via haversine or turf-like utilities).
- Exact CSS styling and component layout tokens in Tailwind CSS, adhering to the high-contrast dark freight logistics aesthetic.
- Specific unit test fixture definitions and mock data files for CI/CD test automation.
- Dockerfile and WhiteNoise static asset configuration specifics.
