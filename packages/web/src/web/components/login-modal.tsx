import { useState } from "react";
import { authClient, captureToken } from "../lib/auth";

interface LoginModalProps {
  onClose: () => void;
}

export function LoginModal({ onClose }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await authClient.signUp.email(
          { name, email, password },
          {
            onSuccess: (ctx) => {
              captureToken(ctx);
              onClose();
            },
            onError: (ctx) => {
              setError(ctx.error?.message || "SIGNUP_FAILED");
            },
          }
        );
      } else {
        await authClient.signIn.email(
          { email, password },
          {
            onSuccess: (ctx) => {
              captureToken(ctx);
              onClose();
            },
            onError: (ctx) => {
              setError(ctx.error?.message || "AUTH_FAILED");
            },
          }
        );
      }
    } catch (err: any) {
      setError(err.message || "UNKNOWN_ERROR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-cyber-panel border border-cyber-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-mono text-lg text-cyber-cyan tracking-widest glow-cyan">
            {isSignUp ? "REGISTER" : "AUTH_LOGIN"}
          </h2>
          <button
            onClick={onClose}
            className="text-cyber-text-muted hover:text-cyber-red font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block font-mono text-xs text-cyber-text-muted tracking-wider mb-1">
                NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-cyber-bg border border-cyber-border px-3 py-2 font-mono text-sm text-cyber-cyan focus:border-cyber-cyan focus:outline-none tracking-wider"
                placeholder="ADMIN"
              />
            </div>
          )}

          <div>
            <label className="block font-mono text-xs text-cyber-text-muted tracking-wider mb-1">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-cyber-bg border border-cyber-border px-3 py-2 font-mono text-sm text-cyber-cyan focus:border-cyber-cyan focus:outline-none tracking-wider"
              placeholder="ADMIN@CYBER.NET"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-cyber-text-muted tracking-wider mb-1">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full bg-cyber-bg border border-cyber-border px-3 py-2 font-mono text-sm text-cyber-cyan focus:border-cyber-cyan focus:outline-none tracking-wider"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="font-mono text-xs text-cyber-red glow-red tracking-wider">
              ERR: {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-cyber-cyan/10 border border-cyber-cyan text-cyber-cyan font-mono text-sm tracking-widest hover:bg-cyber-cyan/20 transition-colors disabled:opacity-50 cursor-pointer glow-box-cyan"
          >
            {loading
              ? "PROCESSING..."
              : isSignUp
              ? ">> REGISTER <<"
              : ">> ACCESS <<"}
          </button>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="w-full text-center font-mono text-xs text-cyber-text-muted hover:text-cyber-cyan tracking-wider cursor-pointer"
          >
            {isSignUp
              ? "// ALREADY_REGISTERED? LOGIN"
              : "// FIRST_TIME? REGISTER"}
          </button>
        </div>
      </div>
    </div>
  );
}
