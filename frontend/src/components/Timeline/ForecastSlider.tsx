import React from 'react';
import { Play, Pause, RotateCcw, Clock, CloudLightning } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ForecastSliderProps {
  currentHour: number;
  isPlaying: boolean;
  speed: number;
  departureTimeIso?: string;
  onTogglePlay: () => void;
  onReset: () => void;
  onHourChange: (hour: number) => void;
  onToggleSpeed: () => void;
}

export const ForecastSlider: React.FC<ForecastSliderProps> = ({
  currentHour,
  isPlaying,
  speed,
  departureTimeIso,
  onTogglePlay,
  onReset,
  onHourChange,
  onToggleSpeed,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const baseTime = departureTimeIso ? new Date(departureTimeIso) : new Date();
  const forecastDate = new Date(baseTime.getTime() + currentHour * 3600000);
  const formattedTime = forecastDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDay = forecastDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const milestones = [0, 12, 24, 36, 48];

  return (
    <div
      className="rounded-2xl text-sm space-y-2 sm:space-y-3 p-2.5 sm:p-3.5 shadow-2xl transition-all"
      style={{
        background: isDark ? 'rgba(15, 20, 28, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d0d7de',
        backdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 20px 50px rgba(0,0,0,0.6)'
          : '0 12px 40px rgba(0,0,0,0.12)',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-2">
        {/* Title & time */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div
            className="p-1.5 rounded-lg shrink-0"
            style={{
              background: isDark ? 'rgba(95,222,222,0.12)' : '#e6f7f7',
              border: isDark ? '1px solid rgba(95,222,222,0.25)' : '1px solid #008787',
              color: isDark ? '#5FDEDE' : '#008787',
            }}
          >
            <CloudLightning className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
              <span
                className="text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate"
                style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
              >
                48H Timeline
              </span>
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0"
                style={{
                  background: isDark ? 'rgba(95,222,222,0.15)' : '#e6f7f7',
                  color: isDark ? '#5FDEDE' : '#008787',
                  border: isDark ? '1px solid rgba(95,222,222,0.3)' : '1px solid #b2e8e8',
                }}
              >
                +{currentHour}h
              </span>
            </div>
            <div
              className="text-[10px] sm:text-[11px] font-mono flex items-center gap-1 truncate"
              style={{ color: isDark ? '#8B949E' : '#57606A' }}
            >
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span className="truncate">
                {formattedDay} • {formattedTime}
              </span>
            </div>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Speed toggle */}
          <button
            type="button"
            onClick={onToggleSpeed}
            title="Toggle scrubbing speed"
            className="px-2 py-1 sm:py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer min-h-[34px] sm:min-h-0 flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isDark ? '#8B949E' : '#57606A',
            }}
          >
            {speed}x
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={onReset}
            title="Reset to Departure (T+0)"
            className="p-1.5 rounded-lg transition-all cursor-pointer min-h-[34px] min-w-[34px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
              color: isDark ? '#8B949E' : '#57606A',
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Play / Pause button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer min-h-[34px] sm:min-h-0"
            style={{
              background: isPlaying
                ? '#EF4444'
                : isDark
                ? '#5FDEDE'
                : '#008787',
              color: isPlaying ? '#ffffff' : isDark ? '#0F141C' : '#ffffff',
              boxShadow: isPlaying
                ? '0 0 15px rgba(239,68,68,0.4)'
                : isDark
                ? '0 0 15px rgba(95,222,222,0.4)'
                : '0 4px 12px rgba(0,135,135,0.3)',
            }}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden xs:inline">Play</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={48}
          step={1}
          value={currentHour}
          onChange={(e) => onHourChange(parseInt(e.target.value, 10))}
          className="w-full cursor-pointer h-2 accent-cyan-400 touch-pan-x"
        />

        {/* Milestone labels */}
        <div
          className="flex justify-between text-[10px] font-mono px-1"
          style={{ color: isDark ? '#586069' : '#8C959F' }}
        >
          {milestones.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onHourChange(h)}
              className="cursor-pointer transition-colors min-h-[24px] flex items-center"
              style={{
                background: 'none',
                border: 'none',
                color: currentHour === h ? (isDark ? '#5FDEDE' : '#008787') : 'inherit',
                fontWeight: currentHour === h ? 700 : 400,
              }}
            >
              T+{h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
