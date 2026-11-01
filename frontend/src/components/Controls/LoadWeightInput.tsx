import React from 'react';
import { Weight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface LoadWeightInputProps {
  value: number;
  onChange: (weight: number) => void;
}

export const LoadWeightInput: React.FC<LoadWeightInputProps> = ({ value, onChange }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const presets = [
    { label: 'Empty', weight: 0 },
    { label: '20k lb', weight: 20000 },
    { label: '32k lb', weight: 32000 },
    { label: '42k lb', weight: 42000 },
    { label: '45k lb', weight: 45000 },
  ];

  const isOver30k = value > 30000;
  const isOver40k = value > 40000;

  return (
    <div
      className="space-y-2.5 rounded-xl p-3"
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
          <Weight className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
          Cargo Payload Weight
        </label>
        <span
          className="text-xs font-mono font-bold"
          style={{ color: isDark ? '#FCD34D' : '#b45309' }}
        >
          {value.toLocaleString()}{' '}
          <span className="text-[10px] font-normal" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
            lbs
          </span>
        </span>
      </div>

      {/* Number input */}
      <input
        type="number"
        min={0}
        max={60000}
        step={500}
        value={value === 0 ? '' : value}
        placeholder="0 (Empty trailer)"
        onChange={(e) => {
          const val = parseFloat(e.target.value) || 0;
          onChange(Math.max(0, Math.min(60000, val)));
        }}
        style={{
          width: '100%',
          background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
          border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '7px 12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: isDark ? '#F0F6FC' : '#1C2227',
          outline: 'none',
        }}
      />

      {/* Presets */}
      <div className="grid grid-cols-5 gap-1">
        {presets.map((preset) => {
          const isSelected = value === preset.weight;
          return (
            <button
              key={preset.weight}
              type="button"
              onClick={() => onChange(preset.weight)}
              className="py-1 px-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer text-center"
              style={
                isSelected
                  ? isDark
                    ? {
                        background: 'rgba(245,158,11,0.18)',
                        border: '1px solid rgba(245,158,11,0.40)',
                        color: '#FCD34D',
                        fontWeight: 600,
                      }
                    : {
                        background: '#fef3c7',
                        border: '1px solid #f59e0b',
                        color: '#92400e',
                        fontWeight: 600,
                      }
                  : isDark
                  ? {
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: '#8B949E',
                    }
                  : {
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      color: '#64748B',
                    }
              }
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* FMCSA stability badge */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
        style={{
          background: isOver40k
            ? isDark ? 'rgba(16,185,129,0.10)' : '#ecfdf5'
            : isOver30k
            ? isDark ? 'rgba(245,158,11,0.10)' : '#fffbeb'
            : isDark ? 'rgba(239,68,68,0.10)' : '#fef2f2',
          border: isOver40k
            ? isDark ? '1px solid rgba(16,185,129,0.25)' : '1px solid #a7f3d0'
            : isOver30k
            ? isDark ? '1px solid rgba(245,158,11,0.25)' : '1px solid #fde68a'
            : isDark ? '1px solid rgba(239,68,68,0.25)' : '1px solid #fecaca',
        }}
      >
        {isOver40k ? (
          <>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: '#10B981' }} />
            <span style={{ color: isDark ? '#6EE7B7' : '#047857' }}>
              Heavy Load: Maximum crosswind resistance (~55+ mph threshold)
            </span>
          </>
        ) : isOver30k ? (
          <>
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: '#F59E0B' }} />
            <span style={{ color: isDark ? '#FCD34D' : '#b45309' }}>
              Medium Load: Moderate stability against crosswind gusts
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#EF4444' }} />
            <span style={{ color: isDark ? '#FCA5A5' : '#b91c1c' }}>
              Light/Empty Trailer: High blow-over susceptibility (&ge;35 mph gusts)
            </span>
          </>
        )}
      </div>
    </div>
  );
};
