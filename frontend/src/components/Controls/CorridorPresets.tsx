import React from 'react';
import { Sparkles, Mountain, Wind, Navigation } from 'lucide-react';
import { LocationPoint } from '../../types/route';
import { useTheme } from '../../context/ThemeContext';

interface CorridorPreset {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  tagStyleDark: React.CSSProperties;
  tagStyleLight: React.CSSProperties;
  icon: React.ReactNode;
  origin: LocationPoint;
  destination: LocationPoint;
  defaultWeight: number;
}

interface CorridorPresetsProps {
  onSelect: (origin: LocationPoint, destination: LocationPoint, weight: number) => void;
}

export const CorridorPresets: React.FC<CorridorPresetsProps> = ({ onSelect }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const presets: CorridorPreset[] = [
    {
      id: 'mountain-pass',
      title: 'I-70 / I-80 Mountain Pass',
      subtitle: 'Denver, CO → Salt Lake City, UT',
      tag: 'Snow & Blizzards',
      tagStyleDark: { color: '#5FDEDE', background: 'rgba(95,222,222,0.12)', border: '1px solid rgba(95,222,222,0.25)' },
      tagStyleLight: { color: '#008787', background: '#e6f7f7', border: '1px solid #b2e8e8' },
      icon: <Mountain className="w-3.5 h-3.5" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />,
      origin: { lat: 39.7392, lng: -104.9903, name: 'Denver, Colorado, United States' },
      destination: { lat: 40.7608, lng: -111.8910, name: 'Salt Lake City, Utah, United States' },
      defaultWeight: 42000,
    },
    {
      id: 'high-wind',
      title: 'I-80 High-Wind Plains',
      subtitle: 'Cheyenne, WY → Omaha, NE',
      tag: 'Blow-Over Risk',
      tagStyleDark: { color: '#FCD34D', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' },
      tagStyleLight: { color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a' },
      icon: <Wind className="w-3.5 h-3.5" style={{ color: isDark ? '#F59E0B' : '#d97706' }} />,
      origin: { lat: 41.1400, lng: -104.8202, name: 'Cheyenne, Wyoming, United States' },
      destination: { lat: 41.2565, lng: -95.9345, name: 'Omaha, Nebraska, United States' },
      defaultWeight: 45000,
    },
    {
      id: 'midwest-corridor',
      title: 'Midwest Freight Arterial',
      subtitle: 'Chicago, IL → Atlanta, GA',
      tag: 'Rain & 3 Paths',
      tagStyleDark: { color: '#6EE7B7', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.22)' },
      tagStyleLight: { color: '#047857', background: '#d1fae5', border: '1px solid #a7f3d0' },
      icon: <Navigation className="w-3.5 h-3.5" style={{ color: isDark ? '#10B981' : '#059669' }} />,
      origin: { lat: 41.8781, lng: -87.6298, name: 'Chicago, Illinois, United States' },
      destination: { lat: 33.7490, lng: -84.3880, name: 'Atlanta, Georgia, United States' },
      defaultWeight: 32000,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5"
          style={{ color: isDark ? '#8B949E' : '#57606A' }}
        >
          <Sparkles className="w-3 h-3" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
          Freight Corridor Presets
        </span>
        <span className="text-[10px] font-mono" style={{ color: isDark ? '#586069' : '#8C959F' }}>
          Select to load
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.origin, preset.destination, preset.defaultWeight)}
            className="flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer group"
            style={{
              background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc';
              (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(95,222,222,0.4)' : '#008787';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : '#ffffff';
              (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e1e4e8';
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="p-1.5 rounded-lg shrink-0 transition-transform group-hover:scale-105"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                }}
              >
                {preset.icon}
              </div>
              <div>
                <div
                  className="text-xs font-semibold leading-tight group-hover:text-cyan-400 transition-colors"
                  style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
                >
                  {preset.title}
                </div>
                <div
                  className="text-[11px] font-medium"
                  style={{ color: isDark ? '#8B949E' : '#64748B' }}
                >
                  {preset.subtitle}
                </div>
              </div>
            </div>

            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={isDark ? preset.tagStyleDark : preset.tagStyleLight}
            >
              {preset.tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
