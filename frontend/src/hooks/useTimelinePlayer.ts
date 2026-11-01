import { useState, useEffect, useRef } from 'react';

interface UseTimelinePlayerProps {
  maxHours?: number;
  initialHour?: number;
  baseIntervalMs?: number;
}

export const useTimelinePlayer = ({
  maxHours = 48,
  initialHour = 0,
  baseIntervalMs = 750,
}: UseTimelinePlayerProps = {}) => {
  const [currentHour, setCurrentHour] = useState<number>(initialHour);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1); // 1x or 2x
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const interval = baseIntervalMs / speed;
      timerRef.current = setInterval(() => {
        setCurrentHour((prev) => {
          if (prev >= maxHours) {
            setIsPlaying(false);
            return 0; // Loop or stop
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, speed, maxHours, baseIntervalMs]);

  const togglePlay = () => setIsPlaying((prev) => !prev);
  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);
  const reset = () => {
    setIsPlaying(false);
    setCurrentHour(0);
  };
  const setHour = (h: number) => {
    setCurrentHour(Math.max(0, Math.min(maxHours, h)));
  };
  const toggleSpeed = () => setSpeed((prev) => (prev === 1 ? 2 : 1));

  return {
    currentHour,
    isPlaying,
    speed,
    togglePlay,
    play,
    pause,
    reset,
    setHour,
    toggleSpeed,
  };
};
