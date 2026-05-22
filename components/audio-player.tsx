"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Music,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
}

const playlist: Track[] = [
  {
    id: "1",
    title: "Neon Dreams",
    artist: "Synthwave Collective",
    duration: "3:42",
    durationSeconds: 222,
  },
  {
    id: "2",
    title: "Digital Rain",
    artist: "Ghost Protocol",
    duration: "4:15",
    durationSeconds: 255,
  },
  {
    id: "3",
    title: "Chrome Hearts",
    artist: "Circuit Breaker",
    duration: "3:58",
    durationSeconds: 238,
  },
  {
    id: "4",
    title: "Midnight Run",
    artist: "Neon Rider",
    duration: "5:01",
    durationSeconds: 301,
  },
  {
    id: "5",
    title: "Electric Soul",
    artist: "Binary Sunset",
    duration: "4:33",
    durationSeconds: 273,
  },
  {
    id: "6",
    title: "Data Stream",
    artist: "Hex Protocol",
    duration: "3:27",
    durationSeconds: 207,
  },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const progressRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentTrack = playlist[currentTrackIndex];

  const startProgress = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (isRepeating) {
            return 0;
          }
          setIsPlaying(false);
          return 100;
        }
        return prev + 100 / currentTrack.durationSeconds;
      });
    }, 1000);
  }, [currentTrack.durationSeconds, isRepeating]);

  useEffect(() => {
    if (isPlaying && !isDragging) {
      startProgress();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, isDragging, startProgress]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    setCurrentTrackIndex((prev) =>
      prev === 0 ? playlist.length - 1 : prev - 1
    );
    setProgress(0);
  };

  const handleNext = () => {
    if (isShuffled) {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * playlist.length);
      } while (newIndex === currentTrackIndex && playlist.length > 1);
      setCurrentTrackIndex(newIndex);
    } else {
      setCurrentTrackIndex((prev) =>
        prev === playlist.length - 1 ? 0 : prev + 1
      );
    }
    setProgress(0);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    setProgress(Math.max(0, Math.min(100, clickPosition * 100)));
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setProgress(0);
    setIsPlaying(true);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const currentTime = (progress / 100) * currentTrack.durationSeconds;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        {/* Main Player Card */}
        <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
          {/* Glow Effect */}
          <div className="absolute inset-0 opacity-30 pointer-events-none bg-gradient-to-br from-neon-cyan/20 via-transparent to-neon-pink/20" />

          {/* Header */}
          <div className="relative border-b border-border p-4 md:p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded bg-secondary flex items-center justify-center border border-border">
                <Music className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-mono font-bold text-foreground tracking-wide">
                  NEON_PLAYER
                </h1>
                <p className="text-xs text-muted-foreground font-mono">
                  v2.0.77 // SYSTEM ONLINE
                </p>
              </div>
            </div>
          </div>

          <div className="relative grid md:grid-cols-2 gap-0">
            {/* Now Playing Section */}
            <div className="p-4 md:p-6 border-b md:border-b-0 md:border-r border-border">
              {/* Album Art Placeholder */}
              <div className="relative aspect-square max-w-[280px] mx-auto mb-6 rounded bg-secondary border border-border overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 to-neon-pink/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Animated rings */}
                    <div
                      className={cn(
                        "absolute inset-0 border-2 border-primary/30 rounded-full scale-150 transition-all duration-1000",
                        isPlaying && "animate-ping"
                      )}
                    />
                    <div
                      className={cn(
                        "absolute inset-0 border border-accent/20 rounded-full scale-[2] transition-all duration-1000 delay-300",
                        isPlaying && "animate-ping"
                      )}
                    />
                    <Music className="w-16 h-16 text-primary" />
                  </div>
                </div>
                {/* Scanline effect */}
                <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]" />
              </div>

              {/* Track Info */}
              <div className="text-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  {currentTrack.artist}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div
                  ref={progressRef}
                  onClick={handleProgressClick}
                  onMouseDown={() => setIsDragging(true)}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  className="relative h-2 bg-secondary rounded-full cursor-pointer group"
                >
                  {/* Background glow */}
                  <div
                    className="absolute h-full rounded-full bg-primary transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                  {/* Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity border-2 border-background"
                    style={{ left: `calc(${progress}% - 8px)` }}
                  />
                  {/* Glow effect on progress */}
                  <div
                    className="absolute h-full rounded-full bg-primary/50 blur-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs font-mono text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{currentTrack.duration}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-2 md:gap-4">
                <button
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    isShuffled
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  aria-label="Toggle shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                </button>

                <button
                  onClick={handlePrevious}
                  className="p-2 md:p-3 rounded-lg text-foreground hover:bg-secondary hover:text-primary transition-all duration-200"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <button
                  onClick={handlePlayPause}
                  className={cn(
                    "p-4 md:p-5 rounded-full transition-all duration-300",
                    "bg-primary text-primary-foreground",
                    "hover:scale-105 active:scale-95",
                    "shadow-lg shadow-primary/30",
                    isPlaying && "animate-pulse"
                  )}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 md:w-7 md:h-7" />
                  ) : (
                    <Play className="w-6 h-6 md:w-7 md:h-7 ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleNext}
                  className="p-2 md:p-3 rounded-lg text-foreground hover:bg-secondary hover:text-primary transition-all duration-200"
                  aria-label="Next track"
                >
                  <SkipForward className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <button
                  onClick={() => setIsRepeating(!isRepeating)}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-200",
                    isRepeating
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                  aria-label="Toggle repeat"
                >
                  <Repeat className="w-4 h-4" />
                </button>
              </div>

              {/* Volume Control */}
              <div className="flex items-center gap-3 mt-6 px-4">
                <button
                  onClick={toggleMute}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 relative h-2 bg-secondary rounded-full group">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(Number(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    aria-label="Volume"
                  />
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${isMuted ? 0 : volume}%` }}
                  />
                  <div
                    className="absolute h-full rounded-full bg-accent/50 blur-sm"
                    style={{ width: `${isMuted ? 0 : volume}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                  {isMuted ? 0 : volume}%
                </span>
              </div>
            </div>

            {/* Playlist Section */}
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono font-bold text-foreground uppercase tracking-wider">
                  Playlist
                </h3>
                <span className="text-xs font-mono text-muted-foreground">
                  {playlist.length} tracks
                </span>
              </div>

              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                {playlist.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackSelect(index)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-all duration-200 group",
                      "border border-transparent",
                      index === currentTrackIndex
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : "hover:bg-secondary hover:border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded flex items-center justify-center text-xs font-mono transition-all",
                          index === currentTrackIndex
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        )}
                      >
                        {index === currentTrackIndex && isPlaying ? (
                          <div className="flex gap-0.5 items-end h-3">
                            <span className="w-0.5 bg-current animate-pulse h-full" />
                            <span
                              className="w-0.5 bg-current animate-pulse h-2"
                              style={{ animationDelay: "0.15s" }}
                            />
                            <span
                              className="w-0.5 bg-current animate-pulse h-3"
                              style={{ animationDelay: "0.3s" }}
                            />
                          </div>
                        ) : (
                          String(index + 1).padStart(2, "0")
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-medium truncate text-sm",
                            index === currentTrackIndex && "text-primary"
                          )}
                        >
                          {track.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {track.artist}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {track.duration}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Status Bar */}
          <div className="relative border-t border-border px-4 py-2 md:px-6 md:py-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {isPlaying ? "PLAYING" : "PAUSED"}
                </span>
                <span className="hidden md:inline">
                  TRACK {String(currentTrackIndex + 1).padStart(2, "0")}/
                  {String(playlist.length).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {isShuffled && (
                  <span className="text-primary">SHUFFLE</span>
                )}
                {isRepeating && (
                  <span className="text-accent">REPEAT</span>
                )}
                <span className="hidden md:inline">HIGH_QUALITY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Footer */}
        <div className="text-center mt-6">
          <p className="text-xs font-mono text-muted-foreground">
            CYBERDECK AUDIO SYSTEMS // 2077
          </p>
        </div>
      </div>
    </div>
  );
}
