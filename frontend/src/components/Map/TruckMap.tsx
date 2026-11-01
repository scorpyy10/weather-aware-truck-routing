import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RouteOption, Checkpoint, CorridorHeatmap } from '../../types/route';
import { CheckpointPopup } from './CheckpointPopup';
import { Flame, Maximize2, ShieldAlert, Award, Sun, Moon, ChevronDown, Check, Route } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

// Configure MapLibre Web Worker URL to static clean file in public folder to avoid Vite dev-server client injection
if (typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
} else if ((maplibregl as any).config) {
  (maplibregl as any).config.WORKER_URL = '/maplibre-gl-worker.mjs';
}

type Map = maplibregl.Map;

interface TruckMapProps {
  routes: RouteOption[];
  selectedRouteId: string | null;
  onSelectRoute: (id: string) => void;
  currentForecastHour?: number;
  corridorHeatmap?: CorridorHeatmap | null;
}

// 100% keyless, open-access basemap style specification
// Features Esri Dark Gray Canvas (high contrast, zero API keys required) and OpenStreetMap Standard
const KEYLESS_BASEMAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.esri.com" target="_blank">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
    'osm-standard': {
      type: 'raster',
      tiles: [
        'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 16,
      layout: { visibility: 'visible' },
    },
    {
      id: 'esri-dark-reference-layer',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 16,
      layout: { visibility: 'visible' },
    },
    {
      id: 'osm-standard-base',
      type: 'raster',
      source: 'osm-standard',
      minzoom: 0,
      maxzoom: 19,
      layout: { visibility: 'none' },
    },
  ],
};

const RISK_COLORS: Record<number, string> = {
  1: '#10B981', // Low - emerald
  2: '#F59E0B', // Moderate - amber
  3: '#F97316', // High - orange
  4: '#EF4444', // Severe - red
  5: '#9333EA', // No Travel - purple
};

export const TruckMap: React.FC<TruckMapProps> = ({
  routes,
  selectedRouteId,
  onSelectRoute,
  currentForecastHour = 0,
  corridorHeatmap,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<Checkpoint | null>(null);
  const [popupPixelPos, setPopupPixelPos] = useState<{ x: number; y: number } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  // Close route dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (routeDropdownRef.current && !routeDropdownRef.current.contains(e.target as Node)) {
        setRouteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize MapLibre WebGL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: KEYLESS_BASEMAP_STYLE,
      center: [-98.5795, 39.8283], // Contiguous US Center
      zoom: 4,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      (window as any).map = map;
      setMapLoaded(true);
      map.resize();
    });

    map.on('error', (e) => {
      console.error('MapLibre error event:', e);
    });

    // Resize observer to ensure map canvas automatically resizes with DOM/sidebar changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync MapLibre basemap layers with active theme (Dark Canvas vs Light OSM)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('esri-dark-base-layer')) {
      map.setLayoutProperty('esri-dark-base-layer', 'visibility', isDark ? 'visible' : 'none');
    }
    if (map.getLayer('esri-dark-reference-layer')) {
      map.setLayoutProperty('esri-dark-reference-layer', 'visibility', isDark ? 'visible' : 'none');
    }
    if (map.getLayer('osm-standard-base')) {
      map.setLayoutProperty('osm-standard-base', 'visibility', !isDark ? 'visible' : 'none');
    }
  }, [isDark, mapLoaded]);

  // Helper to build heatmap GeoJSON
  const buildHeatmapGeoJson = useCallback((heatmapData: CorridorHeatmap | null | undefined, hour: number): GeoJSON.FeatureCollection => {
    if (!heatmapData || !heatmapData.hours || heatmapData.hours.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    const hourIndex = Math.min(hour, heatmapData.hours.length - 1);
    const hourData = heatmapData.hours[hourIndex];
    return {
      type: 'FeatureCollection',
      features: (hourData.grid_points || []).map((pt) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pt.lng, pt.lat],
        },
        properties: {
          intensity: pt.intensity,
        },
      })),
    };
  }, []);

  // Helper to build checkpoint GeoJSON for given hour
  const buildCheckpointGeoJson = useCallback((route: RouteOption, hour: number): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: (route.checkpoints || []).map((cp) => {
        const score =
          hour === 0
            ? cp.risk.score
            : (cp.hourly_risk_scores && cp.hourly_risk_scores[hour]) || cp.risk.score;
        const color = RISK_COLORS[score] || '#10B981';

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [cp.location.lng, cp.location.lat],
          },
          properties: {
            index: cp.index,
            distance_from_start_miles: cp.distance_from_start_miles,
            color: color,
            score: score,
            risk_level: cp.risk.level,
            wind_speed: cp.weather.wind_speed_mph,
          },
        };
      }),
    };
  }, []);

  // Recenter camera to fit active route
  const fitRouteBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !routes || routes.length === 0) return;
    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (activeRoute && activeRoute.geometry && activeRoute.geometry.coordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      activeRoute.geometry.coordinates.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, {
        padding: { top: 90, bottom: 120, left: 80, right: 80 },
        duration: 1000,
        maxZoom: 11,
      });
    }
  }, [routes, selectedRouteId]);

  // EFFECT 1: Route polylines, Origin/Dest markers & initial camera fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !routes || routes.length === 0) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove existing layers and sources
    const layerIds = ['selected-checkpoints-halo', 'selected-checkpoints', 'heatmap-layer'];
    layerIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });

    routes.forEach((r) => {
      if (map.getLayer(`route-casing-${r.id}`)) map.removeLayer(`route-casing-${r.id}`);
      if (map.getLayer(`route-glow-${r.id}`)) map.removeLayer(`route-glow-${r.id}`);
      if (map.getLayer(`route-line-${r.id}`)) map.removeLayer(`route-line-${r.id}`);
      if (map.getSource(`source-route-${r.id}`)) map.removeSource(`source-route-${r.id}`);
    });

    if (map.getSource('selected-checkpoints-source')) {
      map.removeSource('selected-checkpoints-source');
    }
    if (map.getSource('heatmap-source')) {
      map.removeSource('heatmap-source');
    }

    // Initialize Heatmap Layer
    map.addSource('heatmap-source', {
      type: 'geojson',
      data: buildHeatmapGeoJson(corridorHeatmap, 0),
    });

    map.addLayer({
      id: 'heatmap-layer',
      type: 'heatmap',
      source: 'heatmap-source',
      maxzoom: 16,
      layout: {
        visibility: showHeatmap ? 'visible' : 'none',
      },
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'intensity'],
          0, 0.3,
          1, 1.0
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 1.5,
          6, 3.0,
          9, 5.0
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(16, 185, 129, 0)',
          0.15, 'rgba(16, 185, 129, 0.45)',
          0.35, 'rgba(245, 158, 11, 0.70)',
          0.55, 'rgba(249, 115, 22, 0.85)',
          0.75, 'rgba(239, 68, 68, 0.92)',
          1.0, 'rgba(147, 51, 234, 1.0)',
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3, 28,
          6, 50,
          9, 85
        ],
        'heatmap-opacity': 0.75,
      },
    });

    // Add Route Polylines (Google Maps style: thick casing + vibrant center line)
    const sortedRoutes = [...routes].sort((a, b) => {
      if (a.id === selectedRouteId) return 1;
      if (b.id === selectedRouteId) return -1;
      return 0;
    });

    sortedRoutes.forEach((route) => {
      const isSelected = route.id === selectedRouteId;
      const sourceId = `source-route-${route.id}`;

      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: route.geometry,
          properties: {
            id: route.id,
            name: route.name,
          },
        },
      });

      // 1. Route Casing Border
      map.addLayer({
        id: `route-casing-${route.id}`,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isSelected ? (isDark ? '#0284C7' : '#0369A1') : (isDark ? '#0F172A' : '#94A3B8'),
          'line-width': isSelected ? 10 : 5.5,
          'line-opacity': isSelected ? 0.95 : 0.6,
        },
      });

      // 2. High-Visibility Spotter Cyan Glow for Selected Active Route
      if (isSelected) {
        map.addLayer({
          id: `route-glow-${route.id}`,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': isDark ? '#38BDF8' : '#0284C7',
            'line-width': 18,
            'line-opacity': 0.35,
            'line-blur': 6,
          },
        });
      }

      // 3. Main Center Route Line (Consistent Active Route Color across Option 1, 2, and 3)
      map.addLayer({
        id: `route-line-${route.id}`,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': isSelected
            ? (isDark ? '#38BDF8' : '#0284C7')
            : route.is_recommended
            ? '#10B981'
            : (isDark ? '#64748B' : '#94A3B8'),
          'line-width': isSelected ? 6.5 : 3.5,
          'line-opacity': isSelected ? 1.0 : 0.75,
        },
      });

      map.on('click', `route-line-${route.id}`, () => {
        onSelectRoute(route.id);
      });
      map.on('mouseenter', `route-line-${route.id}`, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', `route-line-${route.id}`, () => {
        map.getCanvas().style.cursor = '';
      });
    });

    // Add Checkpoints for Active Route
    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    if (activeRoute && activeRoute.checkpoints) {
      map.addSource('selected-checkpoints-source', {
        type: 'geojson',
        data: buildCheckpointGeoJson(activeRoute, 0),
      });

      map.addLayer({
        id: 'selected-checkpoints-halo',
        type: 'circle',
        source: 'selected-checkpoints-source',
        paint: {
          'circle-radius': 9,
          'circle-color': isDark ? '#020617' : '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': ['get', 'color'],
        },
      });

      map.addLayer({
        id: 'selected-checkpoints',
        type: 'circle',
        source: 'selected-checkpoints-source',
        paint: {
          'circle-radius': 5.5,
          'circle-color': ['get', 'color'],
        },
      });

      map.on('click', 'selected-checkpoints', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feat = e.features[0];
        const idx = feat.properties?.index;
        const cp = activeRoute.checkpoints.find((c) => c.index === idx);
        if (cp && e.point) {
          setActiveCheckpoint(cp);
          setPopupPixelPos({ x: e.point.x, y: e.point.y });
        }
      });

      map.on('mouseenter', 'selected-checkpoints', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'selected-checkpoints', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Add Custom DOM Markers for Origin (A) and Destination (B)
    if (activeRoute && activeRoute.geometry && activeRoute.geometry.coordinates.length > 1) {
      const coords = activeRoute.geometry.coordinates;
      const origCoord = coords[0];
      const destCoord = coords[coords.length - 1];

      // Origin Marker Element
      const originEl = document.createElement('div');
      originEl.className = 'origin-badge-marker group cursor-pointer';
      originEl.innerHTML = `
        <div style="background: #10B981; color: #FFFFFF; font-weight: 800; font-size: 11px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #FFFFFF; box-shadow: 0 0 15px rgba(16, 185, 129, 0.9);">
          A
        </div>
      `;
      const originMarker = new maplibregl.Marker({ element: originEl, anchor: 'center' })
        .setLngLat([origCoord[0], origCoord[1]])
        .addTo(map);
      markersRef.current.push(originMarker);

      // Destination Marker Element
      const destEl = document.createElement('div');
      destEl.className = 'dest-badge-marker group cursor-pointer';
      destEl.innerHTML = `
        <div style="background: #EF4444; color: #FFFFFF; font-weight: 800; font-size: 11px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #FFFFFF; box-shadow: 0 0 15px rgba(239, 68, 68, 0.9);">
          B
        </div>
      `;
      const destMarker = new maplibregl.Marker({ element: destEl, anchor: 'center' })
        .setLngLat([destCoord[0], destCoord[1]])
        .addTo(map);
      markersRef.current.push(destMarker);
    }

    // Fit camera to active route
    fitRouteBounds();
  }, [routes, selectedRouteId, mapLoaded, onSelectRoute, buildHeatmapGeoJson, corridorHeatmap, buildCheckpointGeoJson, showHeatmap, fitRouteBounds, isDark]);

  // EFFECT 2: 60fps Dynamic Timeline Scrubbing (Updates heatmap & checkpoints WITHOUT moving camera or flickering)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const heatmapSrc = map.getSource('heatmap-source') as maplibregl.GeoJSONSource | undefined;
    if (heatmapSrc) {
      heatmapSrc.setData(buildHeatmapGeoJson(corridorHeatmap, currentForecastHour));
    }

    const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
    const checkpointSrc = map.getSource('selected-checkpoints-source') as maplibregl.GeoJSONSource | undefined;
    if (checkpointSrc && activeRoute) {
      checkpointSrc.setData(buildCheckpointGeoJson(activeRoute, currentForecastHour));
    }
  }, [currentForecastHour, corridorHeatmap, mapLoaded, routes, selectedRouteId, buildHeatmapGeoJson, buildCheckpointGeoJson]);

  // Toggle heatmap visibility in MapLibre layer
  const handleToggleHeatmap = () => {
    const nextState = !showHeatmap;
    setShowHeatmap(nextState);
    const map = mapRef.current;
    if (map && map.getLayer('heatmap-layer')) {
      map.setLayoutProperty('heatmap-layer', 'visibility', nextState ? 'visible' : 'none');
    }
  };

  // Keep active popup anchored to map coordinates during pan/zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeCheckpoint) return;

    const updatePos = () => {
      const pt = map.project([activeCheckpoint.location.lng, activeCheckpoint.location.lat]);
      setPopupPixelPos({ x: pt.x, y: pt.y });
    };

    map.on('move', updatePos);
    return () => {
      map.off('move', updatePos);
    };
  }, [activeCheckpoint]);

  return (
    <div
      className="relative w-full h-full overflow-hidden transition-colors duration-200"
      style={{ background: isDark ? '#0A0E14' : '#E5E9F0' }}
    >
      {/* MapLibre WebGL Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Floating Top Control HUD Bar (Unified, Clean, Responsive Layout) */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pointer-events-none">
        {/* Left: Premium Route Selector Dropdown Menu */}
        {routes && routes.length > 0 ? (
          <div ref={routeDropdownRef} className="relative pointer-events-auto self-start sm:self-auto">
            {/* Active Route Trigger Button */}
            {(() => {
              const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];
              const activeIndex = routes.findIndex((r) => r.id === selectedRouteId);
              const optIndex = activeIndex >= 0 ? activeIndex + 1 : 1;
              const hours = Math.floor(activeRoute.duration_hours);
              const mins = Math.round((activeRoute.duration_hours - hours) * 60);

              return (
                <button
                  type="button"
                  onClick={() => setRouteDropdownOpen(!routeDropdownOpen)}
                  className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl shadow-xl transition-all cursor-pointer min-h-[42px] select-none group"
                  style={{
                    background: isDark ? 'rgba(15, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    border: isDark
                      ? routeDropdownOpen
                        ? '1px solid #38BDF8'
                        : '1px solid rgba(255, 255, 255, 0.14)'
                      : routeDropdownOpen
                      ? '1px solid #0284c7'
                      : '1px solid #d0d7de',
                    backdropFilter: 'blur(20px)',
                    boxShadow: isDark
                      ? '0 10px 30px rgba(0,0,0,0.5), 0 0 15px rgba(56,189,248,0.15)'
                      : '0 4px 14px rgba(0,0,0,0.08)',
                  }}
                  title="Choose active corridor route"
                  aria-expanded={routeDropdownOpen}
                >
                  {/* Option Badge */}
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: isDark ? 'rgba(56,189,248,0.20)' : '#e0f2fe',
                      color: isDark ? '#38BDF8' : '#0284c7',
                      border: isDark ? '1px solid rgba(56,189,248,0.35)' : '1px solid #bae6fd',
                    }}
                  >
                    OPT {optIndex}
                  </span>

                  {activeRoute.is_recommended ? (
                    <Award className="w-4 h-4 shrink-0" style={{ color: isDark ? '#34D399' : '#059669' }} />
                  ) : (
                    <Route className="w-4 h-4 shrink-0 opacity-70" style={{ color: isDark ? '#38BDF8' : '#0284c7' }} />
                  )}

                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold tracking-tight" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
                        {activeRoute.name}
                      </span>
                      {activeRoute.is_recommended && (
                        <span
                          className="hidden md:inline text-[9px] font-extrabold uppercase px-1 rounded"
                          style={{
                            background: isDark ? 'rgba(52,211,153,0.18)' : '#dcfce7',
                            color: isDark ? '#34D399' : '#15803d',
                          }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                      {hours}h {mins}m • {activeRoute.distance_miles} mi
                      {activeRoute.risk_metrics.no_travel_miles > 0 && (
                        <span className="text-purple-400 font-bold ml-1">
                          • {activeRoute.risk_metrics.no_travel_miles}mi Alert
                        </span>
                      )}
                    </span>
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 ml-1 transition-transform duration-200 shrink-0 ${
                      routeDropdownOpen ? 'rotate-180' : ''
                    }`}
                    style={{ color: isDark ? '#8B949E' : '#64748B' }}
                  />
                </button>
              );
            })()}

            {/* Dropdown Menu Overlay */}
            {routeDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 z-30 rounded-2xl p-1.5 shadow-2xl text-xs space-y-1 w-80 max-w-[calc(100vw-24px)] pointer-events-auto"
                style={{
                  background: isDark ? 'rgba(15, 20, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #d0d7de',
                  backdropFilter: 'blur(20px)',
                  boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.12)',
                }}
              >
                <div
                  className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between"
                  style={{
                    color: isDark ? '#8B949E' : '#64748B',
                    borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #f1f5f9',
                  }}
                >
                  <span>Select Active Route Corridor</span>
                  <span className="font-mono">{routes.length} Available</span>
                </div>

                <div className="py-1 space-y-1">
                  {routes.map((r, idx) => {
                    const isSelected = r.id === selectedRouteId;
                    const hours = Math.floor(r.duration_hours);
                    const mins = Math.round((r.duration_hours - hours) * 60);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          onSelectRoute(r.id);
                          setRouteDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer group"
                        style={
                          isSelected
                            ? isDark
                              ? {
                                  background: 'rgba(56,189,248,0.14)',
                                  border: '1px solid rgba(56,189,248,0.3)',
                                  color: '#38BDF8',
                                }
                              : {
                                  background: '#eff6ff',
                                  border: '1px solid #bae6fd',
                                  color: '#0284c7',
                                }
                            : {
                                background: 'transparent',
                                border: '1px solid transparent',
                                color: isDark ? '#F0F6FC' : '#1C2227',
                              }
                        }
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              background: isSelected
                                ? isDark ? 'rgba(56,189,248,0.25)' : '#dbeafe'
                                : isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                              color: isSelected
                                ? isDark ? '#38BDF8' : '#0284c7'
                                : isDark ? '#8B949E' : '#64748B',
                            }}
                          >
                            OPT {idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs truncate">
                                {r.name}
                              </span>
                              {r.is_recommended && (
                                <Award className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              )}
                            </div>
                            <div className="text-[10px] font-mono opacity-70">
                              {hours}h {mins}m • {r.distance_miles} mi • Risk {r.risk_metrics.average_risk.toFixed(1)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.risk_metrics.no_travel_miles > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                              style={{
                                background: isDark ? 'rgba(139,92,246,0.25)' : '#f3e8ff',
                                color: isDark ? '#C084FC' : '#7e22ce',
                              }}
                            >
                              {r.risk_metrics.no_travel_miles}m Alert
                            </span>
                          )}
                          {isSelected && (
                            <Check className="w-4 h-4 shrink-0" style={{ color: isDark ? '#38BDF8' : '#0284c7' }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : <div />}

        {/* Right: Map Layers & Utility Toolbar with Embedded Legend Dropdown */}
        <div className="relative pointer-events-auto self-end sm:self-auto shrink-0">
          <div
            className="flex items-center gap-1 p-1 rounded-xl shadow-xl"
            style={{
              background: isDark ? 'rgba(15, 20, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #d0d7de',
              backdropFilter: 'blur(20px)',
              boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.08)',
            }}
          >
            {/* Heatmap Toggle with Visible Label */}
            <button
              type="button"
              onClick={handleToggleHeatmap}
              title={showHeatmap ? 'Turn off Spotter Lens Weather Heatmap' : 'Turn on Spotter Lens Weather Heatmap'}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px] sm:min-h-0"
              style={
                showHeatmap
                  ? isDark
                    ? { background: 'rgba(245,158,11,0.20)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.4)' }
                    : { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
                  : { border: '1px solid transparent', color: isDark ? '#8B949E' : '#64748B' }
              }
            >
              <Flame className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} />
              <span className="font-medium">Heatmap</span>
            </button>

            {/* Dark / Light Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-transparent min-h-[36px] sm:min-h-0"
              style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Recenter Viewport */}
            <button
              type="button"
              onClick={fitRouteBounds}
              title="Recenter camera to corridor bounds"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-transparent min-h-[36px] sm:min-h-0"
              style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
            >
              <Maximize2 className="w-3.5 h-3.5 opacity-70 shrink-0" />
              <span className="hidden md:inline">Recenter</span>
            </button>

            {/* Legend Toggle */}
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              title="Toggle Weather Risk Scale Legend"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all min-h-[36px] sm:min-h-0"
              style={
                showLegend
                  ? isDark
                    ? { background: 'rgba(95,222,222,0.15)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                    : { background: '#e6f7f7', color: '#008787', border: '1px solid #b2e8e8' }
                  : { border: '1px solid transparent', color: isDark ? '#8B949E' : '#64748B' }
              }
            >
              Legend
            </button>
          </div>

          {/* Floating Collapsible Weather Risk Scale Legend — Anchored Directly Below Toolbar */}
          {showLegend && (
            <div
              className="absolute top-full right-0 mt-2 z-30 rounded-xl p-3 shadow-2xl text-xs space-y-2 w-64 max-w-[calc(100vw-24px)] pointer-events-auto"
              style={{
                background: isDark ? 'rgba(15, 20, 28, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #d0d7de',
                backdropFilter: 'blur(20px)',
                boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.12)',
              }}
            >
              <div
                className="flex items-center justify-between pb-1.5"
                style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8' }}
              >
                <span
                  className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5"
                  style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
                >
                  <ShieldAlert className="w-3.5 h-3.5" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
                  Weather Risk Scale
                </span>
                <span className="text-[10px] font-mono font-medium" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                  FMCSA Rules
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                    <span style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}>Low Risk</span>
                  </div>
                  <span className="font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                    &lt;25 mph | &lt;0.10&quot;
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 shrink-0" />
                    <span style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}>Moderate</span>
                  </div>
                  <span className="font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                    25–34 mph | 0.10–0.25&quot;
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50 shrink-0" />
                    <span style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}>High Hazard</span>
                  </div>
                  <span className="font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                    35–44 mph | 0.25–0.50&quot;
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50 shrink-0" />
                    <span style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}>Severe Risk</span>
                  </div>
                  <span className="font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                    45–54 mph | 0.50–1.00&quot;
                  </span>
                </div>

                <div
                  className="flex items-center justify-between pt-1"
                  style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shadow-sm shadow-purple-600/50 shrink-0" />
                    <span className="font-bold" style={{ color: isDark ? '#C084FC' : '#7e22ce' }}>
                      No Travel Alert
                    </span>
                  </div>
                  <span className="font-mono font-bold" style={{ color: isDark ? '#C084FC' : '#7e22ce' }}>
                    &ge;55 mph / Cargo Esc
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Checkpoint Inspection Popup */}
      {activeCheckpoint && popupPixelPos && (
        <div
          className="absolute z-30 pointer-events-auto transform -translate-x-1/2 -translate-y-full pb-4"
          style={{
            left: `${popupPixelPos.x}px`,
            top: `${popupPixelPos.y}px`,
          }}
        >
          <CheckpointPopup
            checkpoint={activeCheckpoint}
            currentForecastHour={currentForecastHour}
            onClose={() => setActiveCheckpoint(null)}
          />
        </div>
      )}
    </div>
  );
};
