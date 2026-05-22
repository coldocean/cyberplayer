import { useState, useRef } from "react";
import { getToken } from "../lib/auth";

interface UploadModalProps {
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError("TITLE AND FILE REQUIRED");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Get duration from audio file
      const audioDuration = await getAudioDuration(file);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title.trim());
      if (audioDuration) {
        formData.append("duration", String(Math.round(audioDuration)));
      }

      const token = getToken();
      const res = await fetch("/api/tracks/upload", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Upload failed");
      }

      onUploaded();
    } catch (err: any) {
      setError(err.message || "UPLOAD_FAILED");
    } finally {
      setUploading(false);
    }
  };

  const getAudioDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      });
      audio.addEventListener("error", () => resolve(null));
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.replace(/\.mp3$/i, "").replace(/[_-]/g, " "));
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-cyber-panel border border-cyber-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-lg text-cyber-cyan tracking-widest glow-cyan">
            UPLOAD_TRACK
          </h2>
          <button
            onClick={onClose}
            className="text-cyber-text-muted hover:text-cyber-red font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs text-cyber-text-muted tracking-wider mb-1">
              TRACK_TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-cyber-bg border border-cyber-border px-3 py-2 font-mono text-sm text-cyber-cyan focus:border-cyber-cyan focus:outline-none tracking-wider"
              placeholder="ENTER_TRACK_NAME"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-cyber-text-muted tracking-wider mb-1">
              AUDIO_FILE
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`w-full border-2 border-dashed px-3 py-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-cyber-cyan bg-cyber-cyan/5"
                  : file
                  ? "border-cyber-cyan/40 bg-cyber-cyan/5"
                  : "border-cyber-border hover:border-cyber-cyan/40"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    if (!title) {
                      setTitle(f.name.replace(/\.mp3$/i, "").replace(/[_-]/g, " "));
                    }
                  }
                }}
              />
              {file ? (
                <span className="font-mono text-sm text-cyber-cyan tracking-wider">
                  {file.name}
                </span>
              ) : (
                <span className="font-mono text-xs text-cyber-text-muted tracking-wider">
                  DROP_MP3_HERE // OR_CLICK_TO_SELECT
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="font-mono text-xs text-cyber-red glow-red tracking-wider">
              ERR: {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-cyber-red/20 border border-cyber-red text-cyber-red font-mono text-sm tracking-widest hover:bg-cyber-red/30 transition-colors disabled:opacity-50 cursor-pointer glow-box-red"
          >
            {uploading ? "UPLOADING..." : ">> UPLOAD <<"}
          </button>
        </div>
      </div>
    </div>
  );
}
