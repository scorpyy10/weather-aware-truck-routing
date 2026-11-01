import React from 'react';
import { Checkpoint } from '../../types/route';
import { Wind, CloudRain, Snowflake, Thermometer, Clock, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface CheckpointPopupProps {
  checkpoint: Checkpoint;
  currentForecastHour?: number;
  onClose: () => void;
}

const getRiskBadgeStyle = (level: string, isDark: boolean): React.CSSProperties => {
  switch (level) {
    case 'Low':
      return {
        background: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
        color: isDark ? '#34D399' : '#047857',
        border: isDark ? '1px solid rgba(16,185,129,0.3)' : '1px solid #a7f3d0',
      };
    case 'Moderate':
      return {
        background: isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb',
        color: isDark ? '#FCD34D' : '#b45309',
        border: isDark ? '1px solid rgba(245,158,11,0.3)' : '1px solid #fde68a',
      };
    case 'High':
      return {
        background: isDark ? 'rgba(249,115,22,0.15)' : '#fff7ed',
        color: isDark ? '#FED7AA' : '#c2410c',
        border: isDark ? '1px solid rgba(249,115,22,0.3)' : '1px solid #fed7aa',
      };
    case 'Severe':
      return {
        background: isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
        color: isDark ? '#FCA5A5' : '#b91c1c',
        border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid #fecaca',
      };
    case 'No Travel':
      return {
        background: isDark ? 'rgba(139,92,246,0.18)' : '#faf5ff',
        color: isDark ? '#C4B5FD' : '#7e22ce',
        border: isDark ? '1px solid rgba(139,92,246,0.35)' : '1px solid #d8b4fe',
      };
    default:
      return {
        background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
        color: isDark ? '#8B949E' : '#64748B',
        border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #cbd5e1',
      };
  }
};

export const CheckpointPopup: React.FC<CheckpointPopupProps> = ({
  checkpoint,
  currentForecastHour = 0,
  onClose,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { index, distance_from_start_miles, eta, weather, risk, hourly_risk_scores } = checkpoint;

  const etaDate = new Date(eta);
  const formattedEta = etaDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  const scrubbedScore =
    hourly_risk_scores && hourly_risk_scores[currentForecastHour]
      ? hourly_risk_scores[currentForecastHour]
      : risk.score;

  const scoreLabels: Record<number, string> = {
    1: 'Low',
    2: 'Moderate',
    3: 'High',
    4: 'Severe',
    5: 'No Travel',
  };
  const scrubbedLevel = scoreLabels[scrubbedScore] || risk.level;
  const displayLevel = currentForecastHour === 0 ? risk.level : scrubbedLevel;

  return (
    <div
      className="rounded-xl shadow-2xl text-xs space-y-3 z-30"
      style={{
        background: isDark ? 'rgba(15, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid #d0d7de',
        backdropFilter: 'blur(20px)',
        padding: '14px',
        width: '270px',
        boxShadow: isDark
          ? '0 20px 50px rgba(0,0,0,0.6)'
          : '0 12px 35px rgba(0,0,0,0.15)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between pb-2"
        style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{
              background: isDark ? 'rgba(95,222,222,0.15)' : '#e6f7f7',
              color: isDark ? '#5FDEDE' : '#008787',
              border: isDark ? '1px solid rgba(95,222,222,0.3)' : '1px solid #b2e8e8',
            }}
          >
            CP #{index + 1}
          </span>
          <span className="font-semibold" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            Mile {distance_from_start_miles}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded cursor-pointer transition-colors"
          style={{ color: isDark ? '#8B949E' : '#64748B' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ETA and Timeline offset */}
      <div
        className="flex items-center justify-between text-[11px] font-mono"
        style={{ color: isDark ? '#8B949E' : '#57606A' }}
      >
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          ETA: {formattedEta}
        </span>
        {currentForecastHour > 0 && (
          <span style={{ color: isDark ? '#5FDEDE' : '#008787' }}>T+{currentForecastHour}h Forecast</span>
        )}
      </div>

      {/* Weather metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="p-2 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center gap-1 text-[10px]" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            <Wind className="w-3 h-3" />
            <span>Wind Speed</span>
          </div>
          <div className="font-bold text-xs mt-0.5" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            {weather.wind_speed_mph} mph
          </div>
        </div>

        <div
          className="p-2 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center gap-1 text-[10px]" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            <Thermometer className="w-3 h-3" />
            <span>Temperature</span>
          </div>
          <div className="font-bold text-xs mt-0.5" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            {weather.temp_f}°F
          </div>
        </div>

        <div
          className="p-2 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center gap-1 text-[10px]" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            <CloudRain className="w-3 h-3" />
            <span>Rainfall</span>
          </div>
          <div className="font-bold text-xs mt-0.5" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            {weather.rain_in_per_hr}&quot; / hr
          </div>
        </div>

        <div
          className="p-2 rounded-lg"
          style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
          }}
        >
          <div className="flex items-center gap-1 text-[10px]" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            <Snowflake className="w-3 h-3" />
            <span>Snowfall</span>
          </div>
          <div className="font-bold text-xs mt-0.5" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            {weather.snow_in_per_hr}&quot; / hr
          </div>
        </div>
      </div>

      {/* Risk Badge and Primary Hazard */}
      <div
        className="p-2.5 rounded-lg space-y-1.5"
        style={{
          background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isDark ? '#8B949E' : '#57606A' }}>
            Spotter Risk Level
          </span>
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={getRiskBadgeStyle(displayLevel, isDark)}
          >
            {displayLevel}
          </span>
        </div>
        <div
          className="text-[11px] leading-tight flex items-start gap-1"
          style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}
        >
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
          <span>{risk.trigger_rule}</span>
        </div>
      </div>
    </div>
  );
};
