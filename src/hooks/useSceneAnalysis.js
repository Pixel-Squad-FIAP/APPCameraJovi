import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeFrame, SAMPLE_HEIGHT, SAMPLE_WIDTH, suggestMode } from '../lib/sceneAnalysis.js';

const SAMPLE_INTERVAL = 800;
const REQUIRED_STREAK = 3;
const DISMISS_COOLDOWN = 45000;

// Analisa o visor periodicamente e só sugere um modo depois de alguns quadros
// consecutivos com a mesma leitura (evita sugestões piscando).
export function useSceneAnalysis(videoRef, { enabled, suggest = true, currentMode }) {
  const [suggestion, setSuggestion] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const streakRef = useRef({ type: null, count: 0 });
  const dismissedRef = useRef({});
  const canvasRef = useRef(null);

  useEffect(() => {
    setSuggestion(null);
    streakRef.current = { type: null, count: 0 };
  }, [currentMode]);

  useEffect(() => {
    if (!enabled) {
      setSuggestion(null);
      setMetrics(null);
      return undefined;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = SAMPLE_WIDTH;
      canvasRef.current.height = SAMPLE_HEIGHT;
    }
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const { data } = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const frameMetrics = analyzeFrame(data, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      setMetrics(frameMetrics);

      const candidate = suggest ? suggestMode(frameMetrics, currentMode) : null;
      const dismissedAt = candidate ? dismissedRef.current[candidate.type] : null;
      const usable = candidate && !(dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN) ? candidate : null;

      const streak = streakRef.current;
      if (usable?.type === streak.type) streak.count += 1;
      else streakRef.current = { type: usable?.type ?? null, count: usable ? 1 : 0 };

      if (usable && streakRef.current.count >= REQUIRED_STREAK) setSuggestion(usable);
      else if (!usable) setSuggestion(null);
    }, SAMPLE_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [enabled, suggest, currentMode, videoRef]);

  const dismiss = useCallback(() => {
    setSuggestion((current) => {
      if (current) dismissedRef.current[current.type] = Date.now();
      return null;
    });
  }, []);

  return { suggestion, metrics, dismiss };
}
