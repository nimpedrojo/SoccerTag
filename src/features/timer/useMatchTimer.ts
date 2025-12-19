import { useEffect, useRef, useState } from "react";

export type MatchPeriod = "1T" | "2T";

export interface MatchTimerState {
  tMatchMs: number; // elapsed match time in ms
  running: boolean;
  period: MatchPeriod;
}

export interface UseMatchTimerOptions {
  initialPeriod?: MatchPeriod;
  /**
   * Optional initial offset in ms (e.g. resuming after refresh).
   */
  initialElapsedMs?: number;
}

export interface UseMatchTimer {
  tMatchMs: number;
  running: boolean;
  period: MatchPeriod;
  start: () => void;
  pause: () => void;
  reset: (opts?: { period?: MatchPeriod }) => void;
  setPeriod: (next: MatchPeriod) => void;
}

/**
 * Match timer: start/pause/reset with stable elapsed ms.
 * Uses performance.now() for monotonic timing and keeps accumulated time.
 */
export function useMatchTimer(
  options: UseMatchTimerOptions = {}
): UseMatchTimer {
  const { initialPeriod = "1T", initialElapsedMs = 0 } = options;
  const [state, setState] = useState<MatchTimerState>({
    tMatchMs: initialElapsedMs,
    running: false,
    period: initialPeriod,
  });

  // Monotonic timestamps to avoid system clock jumps.
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const accumulatedRef = useRef<number>(initialElapsedMs);

  const tick = () => {
    if (!state.running || startRef.current === null) return;
    const now = performance.now();
    const elapsed = accumulatedRef.current + (now - startRef.current);
    setState((prev) => (prev.tMatchMs === elapsed ? prev : { ...prev, tMatchMs: elapsed }));
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (state.running) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.running]); // re-arm RAF only when running changes

  const start = () => {
    if (state.running) return;
    startRef.current = performance.now();
    setState((prev) => ({ ...prev, running: true }));
  };

  const pause = () => {
    if (!state.running || startRef.current === null) return;
    const now = performance.now();
    accumulatedRef.current += now - startRef.current;
    startRef.current = null;
    setState((prev) => ({ ...prev, running: false, tMatchMs: accumulatedRef.current }));
  };

  const reset = (opts?: { period?: MatchPeriod }) => {
    accumulatedRef.current = 0;
    startRef.current = null;
    setState({
      tMatchMs: 0,
      running: false,
      period: opts?.period ?? state.period,
    });
  };

  const setPeriod = (next: MatchPeriod) => {
    setState((prev) => ({ ...prev, period: next }));
  };

  return {
    tMatchMs: state.tMatchMs,
    running: state.running,
    period: state.period,
    start,
    pause,
    reset,
    setPeriod,
  };
}

/**
 * Ejemplo de uso:
 *
 * const TimerWidget = () => {
 *   const { tMatchMs, running, start, pause, reset, period, setPeriod } = useMatchTimer();
 *   const mm = Math.floor(tMatchMs / 60000);
 *   const ss = Math.floor((tMatchMs % 60000) / 1000).toString().padStart(2, "0");
 *
 *   return (
 *     <div>
 *       <div>Periodo: {period}</div>
 *       <div>Tiempo: {mm}:{ss}</div>
 *       <button onClick={running ? pause : start}>{running ? "Pausar" : "Iniciar"}</button>
 *       <button onClick={() => reset()}>Reset</button>
 *       <button onClick={() => setPeriod(period === "1T" ? "2T" : "1T")}>Cambiar periodo</button>
 *     </div>
 *   );
 * };
 */
