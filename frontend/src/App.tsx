import React, { useState, useEffect } from 'react';
import {
  Truck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Sliders,
  BarChart3,
  RotateCcw,
  Sun,
  Moon,
  Flame,
} from 'lucide-react';
import { RouteCalculationRequest, RouteCalculationResponse } from './types/route';
import { RouteSearchForm } from './components/Controls/RouteSearchForm';
import { TruckMap } from './components/Map/TruckMap';
import { ForecastSlider } from './components/Timeline/ForecastSlider';
import { useTimelinePlayer } from './hooks/useTimelinePlayer';
import { RouteSummaryCard } from './components/Dashboard/RouteSummaryCard';
import { RationaleBanner } from './components/Dashboard/RationaleBanner';
import { SafetyWarningBanner } from './components/Dashboard/SafetyWarningBanner';
import { useTheme } from './context/ThemeContext';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'setup' | 'analysis'>('setup');
  const [activeProduct, setActiveProduct] = useState<'tms' | 'sentinel' | 'lens'>('tms');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteCalculationResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [departureIso, setDepartureIso] = useState<string>('');
  const [currentTimeUtc, setCurrentTimeUtc] = useState<string>('');

  const timeline = useTimelinePlayer({ maxHours: 48 });

  // Update live UTC clock every second
  useEffect(() => {
    const updateUtc = () => {
      const d = new Date();
      setCurrentTimeUtc(d.toUTCString().slice(17, 25) + ' UTC');
    };
    updateUtc();
    const timer = setInterval(updateUtc, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCalculateRoutes = async (req: RouteCalculationRequest) => {
    setIsLoading(true);
    setError(null);
    setDepartureIso(req.departure_time);
    timeline.reset();
    try {
      const resp = await fetch('/api/routes/calculate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.detail || 'Failed to calculate routes. Please check coordinates and input parameters.');
      }

      const data: RouteCalculationResponse = await resp.json();
      setRouteData(data);
      setSelectedRouteId(data.recommended_route_id);
      setActiveTab('analysis'); // Automatically transition to analysis tab
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred during route calculation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAll = () => {
    setRouteData(null);
    setSelectedRouteId(null);
    setError(null);
    setActiveTab('setup');
    timeline.reset();
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden font-sans select-none transition-colors duration-200"
      style={{
        background: isDark ? '#0A0E14' : '#F4F6F8',
        color: isDark ? '#F0F6FC' : '#1C2227',
      }}
    >
      {/* ── Top Spotter TMS Header Bar ── */}
      <header
        className="h-14 px-3 sm:px-4 flex items-center justify-between shrink-0 z-30 transition-colors duration-200"
        style={{
          background: isDark ? 'rgba(15, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #E1E4E8',
          backdropFilter: 'blur(20px)',
          boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.4)' : '0 2px 10px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Left: Spotter Logo & Brand Mark */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Universal Dispatch Toggle Button (Visible on all screen sizes) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center min-w-[36px] min-h-[36px]"
            style={{
              background: sidebarOpen
                ? isDark
                  ? 'rgba(95,222,222,0.18)'
                  : '#e6f7f7'
                : isDark
                ? 'rgba(255,255,255,0.06)'
                : '#f1f5f9',
              color: sidebarOpen
                ? isDark
                  ? '#5FDEDE'
                  : '#008787'
                : isDark
                ? '#F0F6FC'
                : '#1C2227',
              border: sidebarOpen
                ? isDark
                  ? '1px solid rgba(95,222,222,0.4)'
                  : '1px solid #b2e8e8'
                : isDark
                ? '1px solid rgba(255,255,255,0.10)'
                : '1px solid #cbd5e1',
            }}
            title={sidebarOpen ? 'Collapse Left Dispatch Sidebar' : 'Expand Left Dispatch Sidebar'}
            aria-label="Toggle Dispatch Navigation Menu"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm tracking-tighter shrink-0"
            style={{
              background: 'linear-gradient(135deg, #0969DA 0%, #008787 100%)',
              color: '#ffffff',
              boxShadow: isDark ? '0 0 15px rgba(95,222,222,0.35)' : '0 2px 8px rgba(9,105,218,0.3)',
            }}
          >
            <Truck className="w-4 h-4 text-white" />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
                SPOTTER
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase"
                style={{
                  background: isDark ? 'rgba(95,222,222,0.14)' : '#e6f7f7',
                  color: isDark ? '#5FDEDE' : '#008787',
                  border: isDark ? '1px solid rgba(95,222,222,0.25)' : '1px solid #b2e8e8',
                }}
              >
                TMS
              </span>
            </div>

            {/* Live radar connection indicator */}
            <div
              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium"
              style={{
                background: isDark ? 'rgba(16,185,129,0.10)' : '#ecfdf5',
                color: isDark ? '#34D399' : '#047857',
                border: isDark ? '1px solid rgba(16,185,129,0.22)' : '1px solid #a7f3d0',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>RADAR ONLINE</span>
            </div>
          </div>
        </div>

        {/* Center: Spotter Suite Product Switcher Tabs */}
        <div
          className="hidden md:flex items-center p-1 rounded-xl"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveProduct('tms')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={
              activeProduct === 'tms'
                ? isDark
                  ? { background: 'rgba(95,222,222,0.15)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                  : { background: '#ffffff', color: '#008787', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: isDark ? '#8B949E' : '#64748B' }
            }
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Spotter TMS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProduct('lens')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={
              activeProduct === 'lens'
                ? isDark
                  ? { background: 'rgba(95,222,222,0.15)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                  : { background: '#ffffff', color: '#008787', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: isDark ? '#8B949E' : '#64748B' }
            }
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Spotter Lens (Heatmap)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProduct('sentinel')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={
              activeProduct === 'sentinel'
                ? isDark
                  ? { background: 'rgba(95,222,222,0.15)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                  : { background: '#ffffff', color: '#008787', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: isDark ? '#8B949E' : '#64748B' }
            }
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Sentinel Safety</span>
          </button>
        </div>

        {/* Right: Actions, UTC Clock, Dark/Light Mode Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs">
          {/* Live UTC Clock */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[11px]"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
              color: isDark ? '#8B949E' : '#64748B',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#5FDEDE' : '#008787' }} />
            <span>{currentTimeUtc || 'UTC CLOCK'}</span>
          </div>

          {/* Reset Action */}
          {routeData && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] sm:min-h-0"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1',
                color: isDark ? '#F0F6FC' : '#1C2227',
              }}
            >
              <RotateCcw className="w-3 h-3 opacity-60" />
              <span className="hidden xs:inline">Reset</span>
            </button>
          )}

          {/* Global Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Spotter Light Theme' : 'Switch to Spotter Dark Theme'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[34px] sm:min-h-0"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
              color: isDark ? '#5FDEDE' : '#008787',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline font-mono text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-sky-600" />
                <span className="hidden sm:inline font-mono text-[11px]">Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Mobile Backdrop Overlay (only visible on mobile when sidebar is open) */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Dispatch / TMS Sidebar Panel (Responsive: fixed drawer on mobile, inline flex column on desktop) */}
        <aside
          className={`relative transition-all duration-300 ease-in-out shrink-0 z-40 md:z-20 flex flex-col ${
            sidebarOpen
              ? 'fixed inset-y-0 left-0 w-[88vw] max-w-[24rem] md:static md:w-[23.5rem] lg:w-[26.5rem] shadow-2xl md:shadow-none'
              : 'fixed -translate-x-full md:static md:w-0 md:translate-x-0 overflow-hidden'
          }`}
          style={{
            background: isDark ? 'rgba(15, 20, 28, 0.98)' : '#ffffff',
            borderRight: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e1e4e8',
          }}
        >
          {/* Desktop Collapse Button pinned cleanly to the sidebar's top-right header */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            title="Collapse Sidebar"
            className="hidden md:flex absolute top-3 right-3 z-30 w-7 h-7 rounded-lg items-center justify-center transition-all cursor-pointer group"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid #cbd5e1',
              color: isDark ? '#8B949E' : '#64748B',
            }}
          >
            <ChevronLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>

          {/* Mobile Drawer Header with close button */}
          <div
            className="flex md:hidden items-center justify-between px-4 py-3 shrink-0"
            style={{
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e1e4e8',
            }}
          >
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
              <span className="font-bold text-xs uppercase tracking-wider" style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}>
                Dispatch Console
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                color: isDark ? '#8B949E' : '#64748B',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Sidebar Tabs */}
          <div
            className="flex p-1.5 pr-1.5 md:pr-12 gap-1 shrink-0"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e1e4e8',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('setup')}
              className="flex-1 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[38px] sm:min-h-0"
              style={
                activeTab === 'setup'
                  ? isDark
                    ? { background: 'rgba(95,222,222,0.12)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                    : { background: '#ffffff', color: '#008787', border: '1px solid #b2e8e8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                  : { color: isDark ? '#8B949E' : '#64748B' }
              }
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Dispatch Setup</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              disabled={!routeData}
              className="flex-1 py-2 sm:py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-h-[38px] sm:min-h-0"
              style={
                activeTab === 'analysis'
                  ? isDark
                    ? { background: 'rgba(95,222,222,0.12)', color: '#5FDEDE', border: '1px solid rgba(95,222,222,0.3)' }
                    : { background: '#ffffff', color: '#008787', border: '1px solid #b2e8e8', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
                  : { color: isDark ? '#8B949E' : '#64748B' }
              }
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Route Analysis</span>
              {routeData && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Sidebar Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg flex items-start gap-2.5 text-xs shadow-lg"
                style={{
                  background: isDark ? 'rgba(239,68,68,0.10)' : '#fef2f2',
                  border: isDark ? '1px solid rgba(239,68,68,0.30)' : '1px solid #fecaca',
                  color: isDark ? '#FCA5A5' : '#b91c1c',
                }}
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: Dispatch Controls Form */}
            {activeTab === 'setup' && (
              <div>
                <RouteSearchForm
                  isLoading={isLoading}
                  onSubmit={(req) => {
                    handleCalculateRoutes(req);
                    // On mobile, automatically collapse drawer on submit to show map calculation
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                />
              </div>
            )}

            {/* TAB 2: Route Comparison & Hazard Breakdown */}
            {activeTab === 'analysis' && routeData && (
              <div className="space-y-4">
                {/* Rationale or All No-Travel Warning */}
                <div>
                  {routeData.all_no_travel_warning ? (
                    <SafetyWarningBanner message={routeData.recommendation_rationale} />
                  ) : (
                    <RationaleBanner rationale={routeData.recommendation_rationale} />
                  )}
                </div>

                {/* Header with Switcher Notice */}
                <div
                  className="flex items-center justify-between text-xs pb-2"
                  style={{ borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e1e4e8' }}
                >
                  <span
                    className="font-bold uppercase tracking-wider text-[11px]"
                    style={{ color: isDark ? '#F0F6FC' : '#1C2227' }}
                  >
                    3 Evaluated Corridors
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: isDark ? '#8B949E' : '#64748B' }}>
                    Click card to inspect
                  </span>
                </div>

                {/* 3 Alternative Route Cards */}
                <div className="space-y-3">
                  {routeData.routes.map((route) => (
                    <RouteSummaryCard
                      key={route.id}
                      route={route}
                      isSelected={route.id === selectedRouteId}
                      onSelect={() => {
                        setSelectedRouteId(route.id);
                        if (window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Switch back to setup button */}
                <button
                  type="button"
                  onClick={() => setActiveTab('setup')}
                  className="w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px]"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : '#f1f5f9',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #cbd5e1',
                    color: isDark ? '#F0F6FC' : '#1C2227',
                  }}
                >
                  <Sliders className="w-3.5 h-3.5" style={{ color: isDark ? '#5FDEDE' : '#008787' }} />
                  <span>Modify Load Weight or Sampling Interval</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Floating Expand Sidebar Button when sidebar is collapsed (Desktop) */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="Expand Dispatch Sidebar"
            className="hidden md:flex absolute top-16 left-4 z-30 px-3.5 py-2 rounded-xl shadow-2xl items-center gap-2 text-xs font-bold transition-all cursor-pointer group"
            style={{
              background: isDark ? 'rgba(15, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
              border: isDark ? '1px solid rgba(95, 222, 222, 0.35)' : '1px solid #b2e8e8',
              color: isDark ? '#5FDEDE' : '#008787',
              backdropFilter: 'blur(20px)',
              boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.1)',
            }}
          >
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            <span>Open Dispatch Console</span>
          </button>
        )}

        {/* Main Map Viewport */}
        <main
          className="flex-1 relative h-full w-full overflow-hidden"
          style={{ background: isDark ? '#0A0E14' : '#E5E9F0' }}
        >
          <TruckMap
            routes={routeData ? routeData.routes : []}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            currentForecastHour={timeline.currentHour}
            corridorHeatmap={routeData?.corridor_heatmap}
          />

          {/* Bottom Floating 48h Forecast Timeline Player */}
          {routeData && (
            <div className="absolute bottom-4 left-3 right-3 sm:bottom-6 sm:left-8 sm:right-8 md:left-12 md:right-12 z-20 max-w-2xl mx-auto pointer-events-auto">
              <ForecastSlider
                currentHour={timeline.currentHour}
                isPlaying={timeline.isPlaying}
                speed={timeline.speed}
                departureTimeIso={departureIso}
                onTogglePlay={timeline.togglePlay}
                onReset={timeline.reset}
                onHourChange={timeline.setHour}
                onToggleSpeed={timeline.toggleSpeed}
              />
            </div>
          )}

          {/* Floating Mobile Analysis / Dispatch pill when sidebar is closed (Elevated above timeline slider) */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden absolute left-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl text-xs font-bold transition-all cursor-pointer ${
                routeData ? 'bottom-32 sm:bottom-36' : 'bottom-6'
              }`}
              style={{
                background: isDark ? 'rgba(15, 20, 28, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                border: isDark ? '1px solid rgba(95,222,222,0.35)' : '1px solid #b2e8e8',
                color: isDark ? '#5FDEDE' : '#008787',
                backdropFilter: 'blur(16px)',
                boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.6)' : '0 4px 15px rgba(0,0,0,0.15)',
              }}
            >
              <Sliders className="w-4 h-4" />
              <span>{activeTab === 'analysis' && routeData ? 'View Corridors' : 'Dispatch Options'}</span>
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
