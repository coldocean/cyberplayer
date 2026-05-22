import { useRef, useEffect } from "react";

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

export function Visualizer({ analyserNode, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (analyserNode && isPlaying) {
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);

        const barCount = 64;
        const barWidth = (canvas.width / barCount) * 0.7;
        const gap = (canvas.width / barCount) * 0.3;

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * bufferLength);
          const value = dataArray[dataIndex] / 255;
          const barHeight = value * canvas.height * 0.85;

          const x = i * (barWidth + gap);
          const y = canvas.height - barHeight;

          // Main bar
          const gradient = ctx.createLinearGradient(x, canvas.height, x, y);
          gradient.addColorStop(0, "rgba(0, 255, 240, 0.3)");
          gradient.addColorStop(0.5, "rgba(0, 255, 240, 0.6)");
          gradient.addColorStop(1, "rgba(0, 255, 240, 0.9)");
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Glow
          ctx.shadowColor = "#00fff0";
          ctx.shadowBlur = 8;
          ctx.fillRect(x, y, barWidth, barHeight);
          ctx.shadowBlur = 0;

          // Top highlight
          if (barHeight > 2) {
            ctx.fillStyle = "#00fff0";
            ctx.fillRect(x, y, barWidth, 2);
          }
        }
      } else {
        // Idle state - flat line
        const barCount = 64;
        const barWidth = (canvas.width / barCount) * 0.7;
        const gap = (canvas.width / barCount) * 0.3;

        for (let i = 0; i < barCount; i++) {
          const x = i * (barWidth + gap);
          ctx.fillStyle = "rgba(0, 255, 240, 0.15)";
          ctx.fillRect(x, canvas.height - 2, barWidth, 2);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [analyserNode, isPlaying]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
