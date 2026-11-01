import React from 'react';
import { RouteOption } from '../../types/route';
import { Award, Clock, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface RouteSummaryCardProps {
  route: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
}

const RISK_COLORS = {
  noTravel: '#8B5CF6',
  severe: '#EF4444',
  high: '#F97316',
  moderate: '#F59E0B',
  low: '#10B981',
};

export const RouteSummaryCard: React.FC<RouteSummaryCardProps> = ({ route, isSelected, onSelect }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { is_recommended, rank, name, distance_miles, duration_hours, risk_metrics, checkpoints } = route;

  const hours = Math.floor(duration_hours);
  const minutes = Math.round((duration_hours - hours) * 60);

  const hasNoTravel = risk_metrics.no_travel_miles > 0;

  const totalMi = Math.max(distance_miles, 1);
  const pctNoTravel = (risk_metrics.no_travel_miles / totalMi) * 100;
  const pctSevere = (risk_metrics.severe_miles / totalMi) * 100;
  const pctHigh = (risk_metrics.high_miles / totalMi) * 100;
  const pctMod = (risk_metrics.moderate_miles / totalMi) * 100;
  const pctLow = (risk_metrics.low_miles / totalMi) * 100;

  const cardStyle: React.CSSProperties = isSelected
    ? isDark
      ? {
          background: 'rgba(56,189,248,0.10)',
          border: '1.5px solid #38BDF8',
          boxShadow: '0 0 20px rgba(56,189,248,0.22)',
        }
      : {
          background: '#eff6ff',
          border: '1.5px solid #0284c7',
          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.16)',
        }
    : isDark
    ? {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.08)',
      }
    : {
        background: '#ffffff',
        border: '1px solid #e1e4e8',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      };

  return (
    <div
      onClick={onSelect}
      className="p-3.5 rounded-xl transition-all cursor-pointer relative"
      style={cardStyle}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
          (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.16)' : '#cbd5e1';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.02)' : '#ffffff';
          (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#e1e4e8';
        }
      }}
    >
      {/* Top row: badge + name + rank */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {is_recommended && (
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={
                hasNoTravel
                  ? {
                      background: isDark ? 'rgba(139,92,246,0.15)' : '#f3e8ff',
                      color: isDark ? '#C084FC' : '#7e22ce',
                      border: isDark ? '1px solid rgba(139,92,246,0.3)' : '1px solid #d8b4fe',
                    }
                  : {
                      background: isDark ? 'rgba(95,222,222,0.15)' : '#e6f7f7',
                      color: isDark ? '#5FDEDE' : '#008787',
                      border: isDark ? '1px solid rgba(95,222,222,0.3)' : '1px solid #b2e8e8',
                    }
              }
            >
              <Award className="w-3 h-3" />
              SPOTTER RECOMMENDED
            </span>
          )}
          {!is_recommended && (
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{
                background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                color: isDark ? '#8B949E' : '#64748B',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              }}
            >
              Option {rank}
            </span>
          )}
        </div>

        {isSelected && (
          <span
            className="flex items-center gap-1 text-[10px] font-bold"
            style={{ color: isDark ? '#38BDF8' : '#0284c7' }}
          >
            <CheckCircle2 className="w-3 h-3" />
            Active on Map
          </span>
        )}
      </div>

      {/* Route name */}
      <div
        className="font-bold text-sm mb-1.5"
        style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
      >
        {name}
      </div>

      {/* Distance + Duration */}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1" style={{ color: isDark ? '#8B949E' : '#57606A' }}>
          <Clock className="w-3.5 h-3.5 opacity-70" />
          <span className="font-semibold" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
            {hours}h {minutes}m
          </span>
        </div>
        <span style={{ color: isDark ? '#586069' : '#CBD5E1' }}>•</span>
        <span className="font-semibold" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
          {distance_miles.toFixed(1)}{' '}
          <span className="font-normal" style={{ color: isDark ? '#8B949E' : '#57606A' }}>
            mi
          </span>
        </span>
        <span style={{ color: isDark ? '#586069' : '#CBD5E1' }}>•</span>
        <span className="text-[11px]" style={{ color: isDark ? '#8B949E' : '#57606A' }}>
          {checkpoints.length} checks
        </span>
      </div>

      {/* Hazard breakdown bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span style={{ color: isDark ? '#8B949E' : '#64748B' }}>Corridor Weather Exposure</span>
          <div className="flex items-center gap-2 font-mono">
            {hasNoTravel && (
              <span className="font-bold" style={{ color: RISK_COLORS.noTravel }}>
                {risk_metrics.no_travel_miles}mi No-Travel
              </span>
            )}
            <span style={{ color: isDark ? '#8B949E' : '#64748B' }}>
              Avg Risk: <strong style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>{risk_metrics.average_risk.toFixed(1)}</strong>
            </span>
          </div>
        </div>

        {/* Multi-segment stacked progress bar */}
        <div
          className="h-2 rounded-full overflow-hidden flex"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0' }}
        >
          {pctNoTravel > 0 && (
            <div
              style={{ width: `${pctNoTravel}%`, background: RISK_COLORS.noTravel }}
              title={`No Travel: ${risk_metrics.no_travel_miles} mi`}
            />
          )}
          {pctSevere > 0 && (
            <div
              style={{ width: `${pctSevere}%`, background: RISK_COLORS.severe }}
              title={`Severe: ${risk_metrics.severe_miles} mi`}
            />
          )}
          {pctHigh > 0 && (
            <div
              style={{ width: `${pctHigh}%`, background: RISK_COLORS.high }}
              title={`High: ${risk_metrics.high_miles} mi`}
            />
          )}
          {pctMod > 0 && (
            <div
              style={{ width: `${pctMod}%`, background: RISK_COLORS.moderate }}
              title={`Moderate: ${risk_metrics.moderate_miles} mi`}
            />
          )}
          {pctLow > 0 && (
            <div
              style={{ width: `${pctLow}%`, background: RISK_COLORS.low }}
              title={`Low Risk: ${risk_metrics.low_miles} mi`}
            />
          )}
        </div>
      </div>
    </div>
  );
};
