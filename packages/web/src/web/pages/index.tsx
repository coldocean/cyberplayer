import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { authClient, captureToken, clearToken } from "../lib/auth";
import { Visualizer } from "../components/visualizer";
import { UploadModal } from "../components/upload-modal";
import { LoginModal } from "../components/login-modal";

interface Track {
  id: number;
  title: string;
  filename: string;
  storageKey: string;
  duration: number | null;
  createdAt: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.floor(Math.abs(seconds) % 60);
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlayerPage() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAdmin = !!session?.user;

  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showUpload, setShowUpload] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  const { data: tracksData, isLoading } = useQuery({
    queryKey: ["tracks"],
    queryFn: async () => {
      const res = await api.tracks.$get();
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.tracks[":id"].$delete({ param: { id: String(id) } });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracks"] }),
  });

  const tracks: Track[] = (tracksData as any)?.tracks ?? [];
  const currentTrack = tracks.find((t) => t.id === currentTrackId) ?? null;

  const setupAudioContext = useCallback(() => {
    if (!audioRef.current) return;
    if (!audioContextRef.current) {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceRef.current = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }
  }, []);

  const playTrack = useCallback(
    (track: Track) => {
      if (!audioRef.current) return;
      const audio = audioRef.current;

      if (currentTrackId === track.id && !audio.paused) {
        audio.pause();
        setIsPlaying(false);
        return;
      }

      if (currentTrackId !== track.id) {
        audio.src = `/api/tracks/${track.id}/stream`;
        audio.load();
        setCurrentTrackId(track.id);
      }

      setupAudioContext();
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }
      audio.play();
      setIsPlaying(true);
    },
    [currentTrackId, setupAudioContext]
  );

  const handlePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    setupAudioContext();
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    audioRef.current.currentTime = pct * duration;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      // Auto play next track
      if (currentTrackId !== null) {
        const idx = tracks.findIndex((t) => t.id === currentTrackId);
        if (idx < tracks.length - 1) {
          playTrack(tracks[idx + 1]);
        }
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentTrackId, tracks, playTrack]);

  const timeRemaining = duration > 0 ? -(duration - currentTime) : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="h-screen w-screen bg-cyber-bg flex flex-col no-select relative overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* CRT effects */}
      <div className="crt-overlay" />
      <div className="crt-vignette" />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        preload="auto"
        controlsList="nodownload"
      />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-cyber-border bg-cyber-panel/80 z-10">
        <div className="flex items-center gap-4">
          <span className="text-cyber-red font-mono text-sm tracking-widest glow-red">
            CYBER_PLAYER
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => setShowUpload(true)}
                className="px-3 py-1 bg-cyber-red/20 border border-cyber-red text-cyber-red font-mono text-xs tracking-wider hover:bg-cyber-red/30 transition-colors cursor-pointer"
              >
                + UPLOAD
              </button>
              <button
                onClick={async () => {
                  await authClient.signOut();
                  clearToken();
                }}
                className="px-3 py-1 bg-cyber-muted border border-cyber-border text-cyber-text-muted font-mono text-xs tracking-wider hover:text-cyber-cyan transition-colors cursor-pointer"
              >
                LOGOUT
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="px-3 py-1 bg-cyber-muted border border-cyber-border text-cyber-text-muted font-mono text-xs tracking-wider hover:text-cyber-cyan transition-colors cursor-pointer"
            >
              ADMIN
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Track list - left panel */}
        <div className="w-[38%] min-w-[280px] border-r border-cyber-border flex flex-col bg-cyber-bg/90">
          <div className="px-4 py-2 border-b border-cyber-border">
            <span className="text-cyber-text-muted font-mono text-xs tracking-widest">
              // TRACK_LIST [{tracks.length}]
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-cyber-text-muted font-mono text-sm">
                LOADING...
              </div>
            ) : tracks.length === 0 ? (
              <div className="p-4 text-cyber-text-muted font-mono text-sm">
                NO_TRACKS_FOUND
              </div>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => playTrack(track)}
                  className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-all border-b border-cyber-border/30 group ${
                    currentTrackId === track.id
                      ? "bg-cyber-cyan/5 border-l-2 border-l-cyber-cyan"
                      : "hover:bg-cyber-muted/50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {currentTrackId === track.id && isPlaying ? (
                      <span className="text-cyber-cyan text-xs shrink-0">▶</span>
                    ) : (
                      <span className="text-cyber-text-muted text-xs shrink-0 group-hover:text-cyber-cyan">
                        ○
                      </span>
                    )}
                    <span
                      className={`font-mono text-sm tracking-wider truncate ${
                        currentTrackId === track.id
                          ? "text-cyber-cyan glow-cyan"
                          : "text-cyber-cyan-dim group-hover:text-cyber-cyan"
                      }`}
                    >
                      {track.title.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-cyber-text-muted">
                      {formatDuration(track.duration)}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this track?")) {
                            deleteMutation.mutate(track.id);
                          }
                        }}
                        className="text-cyber-red/40 hover:text-cyber-red text-xs ml-2 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel - now playing */}
        <div className="flex-1 flex flex-col p-6 bg-cyber-bg relative">
          {currentTrack ? (
            <>
              {/* Track title */}
              <div className="mb-6">
                <h1 className="font-mono text-2xl md:text-3xl text-cyber-cyan tracking-widest glow-cyan flicker uppercase">
                  {currentTrack.title}
                </h1>
              </div>

              {/* Visualizer */}
              <div className="flex-1 flex items-center justify-center min-h-[120px] max-h-[250px]">
                <Visualizer
                  analyserNode={analyserRef.current}
                  isPlaying={isPlaying}
                />
              </div>

              {/* Time remaining */}
              <div className="flex justify-end mb-3 mt-4">
                <span className="font-mono text-3xl md:text-4xl text-cyber-red glow-red tracking-wider">
                  {formatTime(timeRemaining)}
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="w-full h-2 bg-cyber-muted cursor-pointer mb-5 relative"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-cyber-red progress-glow transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePlay}
                  className={`w-14 h-14 flex items-center justify-center border-2 transition-all cursor-pointer ${
                    isPlaying
                      ? "border-cyber-text-muted bg-cyber-muted text-cyber-text-muted"
                      : "border-cyber-red bg-cyber-red/20 text-cyber-red hover:bg-cyber-red/30 glow-box-red"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <polygon points="6,4 20,12 6,20" />
                  </svg>
                </button>
                <button
                  onClick={handlePause}
                  className={`w-14 h-14 flex items-center justify-center border-2 transition-all cursor-pointer ${
                    !isPlaying && currentTime > 0
                      ? "border-cyber-red bg-cyber-red/20 text-cyber-red glow-box-red"
                      : "border-cyber-red/50 bg-cyber-red/10 text-cyber-red hover:bg-cyber-red/20"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <rect x="5" y="4" width="5" height="16" />
                    <rect x="14" y="4" width="5" height="16" />
                  </svg>
                </button>
                <button
                  onClick={handleStop}
                  className="w-14 h-14 flex items-center justify-center border-2 border-cyber-red/50 bg-cyber-red/10 text-cyber-red hover:bg-cyber-red/20 transition-all cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <rect x="5" y="5" width="14" height="14" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-cyber-text-muted font-mono text-lg tracking-widest mb-4">
                SELECT_TRACK
              </div>
              <div className="text-cyber-text-muted/50 font-mono text-xs tracking-wider">
                // CHOOSE A TRACK FROM THE LIST TO BEGIN PLAYBACK
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-cyber-red/30 bg-cyber-panel/80 z-10">
        <div className="flex items-center gap-2">
          <span className="text-cyber-text-muted font-mono text-xs">⟐</span>
          <span className="text-cyber-text-muted font-mono text-xs tracking-wider">
            SELECT TRACK
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-cyber-text-muted font-mono text-xs tracking-wider">
            <span className="text-cyber-red">◆</span> PLAY
          </span>
          <span className="text-cyber-text-muted font-mono text-xs tracking-wider">
            <span className="text-cyber-red">◆</span> PAUSE
          </span>
          <span className="text-cyber-text-muted font-mono text-xs tracking-wider">
            <span className="text-cyber-red">◆</span> STOP
          </span>
        </div>
      </div>

      {/* Red line at bottom */}
      <div className="h-[2px] bg-cyber-red/60 glow-box-red" />

      {/* Modals */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            queryClient.invalidateQueries({ queryKey: ["tracks"] });
            setShowUpload(false);
          }}
        />
      )}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}
