import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Navigation,
  Calendar,
  ArrowUpDown,
  Loader2,
  X,
  Compass,
} from 'lucide-react';
import { LocationPoint, RouteCalculationRequest } from '../../types/route';
import { LoadWeightInput } from './LoadWeightInput';
import { IntervalSelector } from './IntervalSelector';
import { CorridorPresets } from './CorridorPresets';
import { useTheme } from '../../context/ThemeContext';

interface RouteSearchFormProps {
  isLoading: boolean;
  onSubmit: (request: RouteCalculationRequest) => void;
}

const InputWrapper: React.FC<{
  children: React.ReactNode;
  label: string;
  dot: string;
  isDark: boolean;
  coords?: { lat: number; lng: number };
}> = ({ children, label, dot, isDark, coords }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label
        className="flex items-center gap-1.5 text-[11px] font-semibold"
        style={{ color: isDark ? '#8B949E' : '#57606A' }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: dot, boxShadow: `0 0 6px ${dot}80` }} />
        {label}
      </label>
      {coords && (
        <span
          className="flex items-center gap-1 text-[10px] font-mono"
          style={{ color: isDark ? '#586069' : '#8C959F' }}
        >
          <Compass className="w-3 h-3 opacity-60" />
          {coords.lat.toFixed(2)}°, {coords.lng.toFixed(2)}°
        </span>
      )}
    </div>
    {children}
  </div>
);

export const RouteSearchForm: React.FC<RouteSearchFormProps> = ({ isLoading, onSubmit }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [origin, setOrigin] = useState<LocationPoint>({
    lat: 39.7392,
    lng: -104.9903,
    name: 'Denver, Colorado, United States',
  });
  const [destination, setDestination] = useState<LocationPoint>({
    lat: 40.7608,
    lng: -111.8910,
    name: 'Salt Lake City, Utah, United States',
  });

  const [originQuery, setOriginQuery] = useState(origin.name || '');
  const [destQuery, setDestQuery] = useState(destination.name || '');
  const [originSuggestions, setOriginSuggestions] = useState<LocationPoint[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<LocationPoint[]>([]);
  const [isOriginLoading, setIsOriginLoading] = useState(false);
  const [isDestLoading, setIsDestLoading] = useState(false);
  const [showOriginMenu, setShowOriginMenu] = useState(false);
  const [showDestMenu, setShowDestMenu] = useState(false);

  const now = new Date();
  now.setMinutes(0, 0, 0);
  const localIsoNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [departureTime, setDepartureTime] = useState(localIsoNow);
  const [loadWeight, setLoadWeight] = useState(42000);
  const [samplingInterval, setSamplingInterval] = useState(25);

  const originContainerRef = useRef<HTMLDivElement>(null);
  const destContainerRef = useRef<HTMLDivElement>(null);
  const originDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const destDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (originContainerRef.current && !originContainerRef.current.contains(e.target as Node)) {
        setShowOriginMenu(false);
      }
      if (destContainerRef.current && !destContainerRef.current.contains(e.target as Node)) {
        setShowDestMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const searchLocations = async (
    query: string,
    setResults: (res: LocationPoint[]) => void,
    setLoading: (l: boolean) => void
  ) => {
    if (!query || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`/api/geocoding/search/?q=${encodeURIComponent(query.trim())}`);
      if (resp.ok) {
        const data = await resp.json();
        setResults(data);
      }
    } catch (e) {
      console.warn('Geocoding search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOriginChange = (text: string) => {
    setOriginQuery(text);
    setShowOriginMenu(true);
    if (originDebounceTimer.current) clearTimeout(originDebounceTimer.current);
    originDebounceTimer.current = setTimeout(() => {
      searchLocations(text, setOriginSuggestions, setIsOriginLoading);
    }, 250);
  };

  const handleDestChange = (text: string) => {
    setDestQuery(text);
    setShowDestMenu(true);
    if (destDebounceTimer.current) clearTimeout(destDebounceTimer.current);
    destDebounceTimer.current = setTimeout(() => {
      searchLocations(text, setDestSuggestions, setIsDestLoading);
    }, 250);
  };

  const handleSwap = () => {
    const tempOrig = origin;
    const tempQuery = originQuery;
    setOrigin(destination);
    setOriginQuery(destQuery);
    setDestination(tempOrig);
    setDestQuery(tempQuery);
  };

  const handlePresetSelect = (pOrig: LocationPoint, pDest: LocationPoint, pWeight: number) => {
    setOrigin(pOrig);
    setOriginQuery(pOrig.name || '');
    setDestination(pDest);
    setDestQuery(pDest.name || '');
    setLoadWeight(pWeight);
  };

  const handleSetDepartNow = () => {
    const current = new Date();
    current.setMinutes(0, 0, 0);
    const localNow = new Date(current.getTime() - current.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDepartureTime(localNow);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isoString = departureTime ? new Date(departureTime).toISOString() : new Date().toISOString();
    onSubmit({
      origin,
      destination,
      departure_time: isoString,
      load_weight: loadWeight,
      sampling_interval_miles: samplingInterval,
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '8px 32px 8px 36px',
    fontSize: '12px',
    fontWeight: 500,
    color: isDark ? '#F0F6FC' : '#1C2227',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: isDark ? 'rgba(15, 20, 28, 0.98)' : '#ffffff',
    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d0d7de',
    borderRadius: '10px',
    boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.5)' : '0 10px 25px rgba(0,0,0,0.10)',
    zIndex: 50,
    maxHeight: '180px',
    overflowY: 'auto',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Presets */}
      <CorridorPresets onSelect={handlePresetSelect} />

      {/* Origin & Destination Card */}
      <div
        className="rounded-xl p-3 space-y-3"
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Origin */}
        <div ref={originContainerRef} style={{ position: 'relative' }}>
          <InputWrapper
            label="Origin (Pickup Terminal)"
            dot="#10B981"
            isDark={isDark}
            coords={origin.lat && origin.lng ? origin : undefined}
          >
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={originQuery}
                onChange={(e) => handleOriginChange(e.target.value)}
                onFocus={() => setShowOriginMenu(true)}
                placeholder="Search pickup city, state, or terminal..."
                required
                style={inputStyle}
              />
              <MapPin className="w-4 h-4" style={{ color: '#10B981', position: 'absolute', left: '10px', top: '8px', pointerEvents: 'none' }} />
              {isOriginLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#10B981', position: 'absolute', right: '10px', top: '8px', pointerEvents: 'none' }} />
              ) : originQuery ? (
                <button
                  type="button"
                  onClick={() => { setOriginQuery(''); setOriginSuggestions([]); }}
                  style={{ position: 'absolute', right: '8px', top: '6px', color: isDark ? '#8B949E' : '#64748B', cursor: 'pointer', background: 'none', border: 'none', padding: '2px' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
            {showOriginMenu && originSuggestions.length > 0 && (
              <div style={dropdownStyle}>
                {originSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setOrigin(item);
                      setOriginQuery(item.name || '');
                      setShowOriginMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    style={{
                      color: isDark ? '#F0F6FC' : '#1C2227',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#10B981' }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: isDark ? '#586069' : '#8C959F' }}>
                      {item.lat.toFixed(2)}, {item.lng.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </InputWrapper>
        </div>

        {/* Swap Origin / Dest Button */}
        <div className="flex justify-center -my-1">
          <button
            type="button"
            onClick={handleSwap}
            title="Swap Origin and Destination"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isDark ? '#8B949E' : '#64748B',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = isDark ? '#5FDEDE' : '#008787';
              (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(95,222,222,0.4)' : '#008787';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = isDark ? '#8B949E' : '#64748B';
              (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0';
            }}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>Reverse</span>
          </button>
        </div>

        {/* Destination */}
        <div ref={destContainerRef} style={{ position: 'relative' }}>
          <InputWrapper
            label="Destination (Delivery Terminal)"
            dot="#EF4444"
            isDark={isDark}
            coords={destination.lat && destination.lng ? destination : undefined}
          >
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={destQuery}
                onChange={(e) => handleDestChange(e.target.value)}
                onFocus={() => setShowDestMenu(true)}
                placeholder="Search destination city, state, or hub..."
                required
                style={inputStyle}
              />
              <Navigation className="w-4 h-4" style={{ color: '#EF4444', position: 'absolute', left: '10px', top: '8px', pointerEvents: 'none' }} />
              {isDestLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#EF4444', position: 'absolute', right: '10px', top: '8px', pointerEvents: 'none' }} />
              ) : destQuery ? (
                <button
                  type="button"
                  onClick={() => { setDestQuery(''); setDestSuggestions([]); }}
                  style={{ position: 'absolute', right: '8px', top: '6px', color: isDark ? '#8B949E' : '#64748B', cursor: 'pointer', background: 'none', border: 'none', padding: '2px' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
            {showDestMenu && destSuggestions.length > 0 && (
              <div style={dropdownStyle}>
                {destSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setDestination(item);
                      setDestQuery(item.name || '');
                      setShowDestMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    style={{
                      color: isDark ? '#F0F6FC' : '#1C2227',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                    }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc'}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Navigation className="w-3.5 h-3.5 shrink-0" style={{ color: '#EF4444' }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-mono shrink-0" style={{ color: isDark ? '#586069' : '#8C959F' }}>
                      {item.lat.toFixed(2)}, {item.lng.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </InputWrapper>
        </div>
      </div>

      {/* Departure Time */}
      <div
        className="rounded-xl p-3"
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <label
            className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: isDark ? '#8B949E' : '#57606A' }}
          >
            <Calendar className="w-3.5 h-3.5" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
            Planned Departure
          </label>
          <button
            type="button"
            onClick={handleSetDepartNow}
            className="text-[10px] font-semibold cursor-pointer transition-colors"
            style={{ color: isDark ? '#5FDEDE' : '#008787', background: 'none', border: 'none' }}
          >
            Depart Now
          </button>
        </div>
        <input
          type="datetime-local"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          style={{
            width: '100%',
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '12px',
            color: isDark ? '#F0F6FC' : '#1C2227',
            fontFamily: 'monospace',
            outline: 'none',
            colorScheme: isDark ? 'dark' : 'light',
          }}
        />
      </div>

      {/* Load Weight */}
      <LoadWeightInput value={loadWeight} onChange={setLoadWeight} />

      {/* Sampling Interval */}
      <IntervalSelector value={samplingInterval} onChange={setSamplingInterval} />

      {/* Submit Button (Spotter Brand Action) */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #0969DA 0%, #008787 100%)'
            : 'linear-gradient(135deg, #0969DA 0%, #008787 100%)',
          color: '#ffffff',
          boxShadow: isDark
            ? '0 4px 20px rgba(95,222,222,0.25)'
            : '0 4px 16px rgba(9,105,218,0.25)',
          marginTop: '6px',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)';
        }}
        onMouseLeave={(e) => {
          if (!isLoading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.0)';
        }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing Weather Corridors &amp; ETAs…</span>
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4" />
            <span>Evaluate 3 Routes (TMS Lens)</span>
          </>
        )}
      </button>
    </form>
  );
};
