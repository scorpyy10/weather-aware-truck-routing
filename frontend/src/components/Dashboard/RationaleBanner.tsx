import React from 'react';
import { Award, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface RationaleBannerProps {
  rationale: string;
}

export const RationaleBanner: React.FC<RationaleBannerProps> = ({ rationale }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="rounded-xl p-3 flex items-start gap-2.5 text-xs"
      style={{
        background: isDark ? 'rgba(95,222,222,0.06)' : '#f0fdfa',
        border: isDark ? '1px solid rgba(95,222,222,0.22)' : '1px solid #b2e8e8',
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      <div
        className="p-1.5 rounded-lg shrink-0 mt-0.5"
        style={{
          background: isDark ? 'rgba(95,222,222,0.14)' : '#e6f7f7',
          border: isDark ? '1px solid rgba(95,222,222,0.30)' : '1px solid #008787',
          color: isDark ? '#5FDEDE' : '#008787',
        }}
      >
        <Award className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <ShieldCheck className="w-3 h-3" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: isDark ? '#5FDEDE' : '#008787' }}
          >
            Decision Rationale
          </span>
        </div>
        <div className="leading-snug" style={{ color: isDark ? '#E6EDF3' : '#1C2227' }}>
          {rationale}
        </div>
        <div className="mt-1 text-[10px] font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
          Hierarchy: No Travel → Severe → High → Avg Risk → Time
        </div>
      </div>
    </div>
  );
};
