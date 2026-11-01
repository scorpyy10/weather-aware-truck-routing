import React from 'react';
import { Ruler } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface IntervalSelectorProps {
  value: number;
  onChange: (interval: number) => void;
}

export const IntervalSelector: React.FC<IntervalSelectorProps> = ({ value, onChange }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const intervals = [
    { value: 10, label: '10 mi', badge: 'High Precision' },
    { value: 25, label: '25 mi', badge: 'Recommended' },
    { value: 50, label: '50 mi', badge: 'Long Haul' },
  ];

  return (
    <div
      className="space-y-2 rounded-xl p-3"
      style={{
        background: isDark ? 'rgba(255,255,255,0.03)' : '#ffffff',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e1e4e8',
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center justify-between">
        <label
          className="flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: isDark ? '#8B949E' : '#57606A' }}
        >
          <Ruler className="w-3.5 h-3.5" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
          Hazard Sampling Interval
        </label>
        <span className="text-[11px] font-mono font-medium" style={{ color: isDark ? '#5FDEDE' : '#008787' }}>
          {value} mi / checkpoint
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {intervals.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs transition-all cursor-pointer"
              style={
                selected
                  ? isDark
                    ? {
                        background: 'rgba(95,222,222,0.14)',
                        border: '1px solid rgba(95,222,222,0.40)',
                        color: '#5FDEDE',
                        boxShadow: '0 0 10px rgba(95,222,222,0.1)',
                      }
                    : {
                        background: '#e6f7f7',
                        border: '1px solid #008787',
                        color: '#008787',
                        fontWeight: 600,
                      }
                  : isDark
                  ? {
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#8B949E',
                    }
                  : {
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#64748B',
                    }
              }
              onMouseEnter={(e) => {
                if (!selected) {
                  (e.currentTarget as HTMLElement).style.color = isDark ? '#F0F6FC' : '#1C2227';
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.16)' : '#cbd5e1';
                }
              }}
              onMouseLeave={(e) => {
                if (!selected) {
                  (e.currentTarget as HTMLElement).style.color = isDark ? '#8B949E' : '#64748B';
                  (e.currentTarget as HTMLElement).style.borderColor = isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
                }
              }}
            >
              <span className="font-semibold">{opt.label}</span>
              <span
                className="text-[9px] font-mono mt-0.5 opacity-80"
              >
                {opt.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
