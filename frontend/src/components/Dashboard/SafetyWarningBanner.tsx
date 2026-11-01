import React from 'react';
import { AlertOctagon, CalendarClock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface SafetyWarningBannerProps {
  message: string;
}

export const SafetyWarningBanner: React.FC<SafetyWarningBannerProps> = ({ message }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="rounded-xl p-3.5 flex items-start gap-3 text-xs"
      style={{
        background: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
        border: isDark ? '1px solid rgba(239,68,68,0.30)' : '1px solid #fecaca',
        boxShadow: isDark ? '0 0 15px rgba(239,68,68,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className="p-1.5 rounded-lg shrink-0"
        style={{
          background: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2',
          border: isDark ? '1px solid rgba(239,68,68,0.30)' : '1px solid #fca5a5',
          color: '#EF4444',
        }}
      >
        <AlertOctagon className="w-4 h-4 status-pulse" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span
            className="font-bold uppercase tracking-wider text-[11px]"
            style={{ color: isDark ? '#FCA5A5' : '#b91c1c' }}
          >
            Critical Advisory — All Routes: No Travel
          </span>
          <span
            className="flex items-center gap-1 text-[10px] font-mono font-semibold"
            style={{ color: isDark ? '#C4B5FD' : '#7c3aed' }}
          >
            <CalendarClock className="w-3 h-3" />
            Delay Required
          </span>
        </div>
        <div className="leading-relaxed font-medium" style={{ color: isDark ? '#E6EDF3' : '#374151' }}>
          {message}
        </div>
      </div>
    </div>
  );
};
