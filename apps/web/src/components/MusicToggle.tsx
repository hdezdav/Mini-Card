"use client";

import { useEffect, useRef, useState } from "react";
import { MusicEngine } from "@/lib/music";

// Floating music toggle — synthesizes a Balatro-style jazz/funk loop with
// the Web Audio engine in @/lib/music. The loop is generated in code, so it
// is fully copyright-free and works offline inside MiniPay / web3 browsers.
//
// Browser autoplay policy: AudioContext can only be created/resumed from a
// user gesture, so music never starts on its own. We restore the user's
// saved preference and start on first interaction (the toggle click counts).

const PREF_KEY = "minicard_music_enabled";
const VOL_KEY = "minicard_music_volume";

export function MusicToggle() {
  const engineRef = useRef<MusicEngine | null>(null);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(0.5);

  // Restore saved preference once on mount.
  useEffect(() => {
    if (!MusicEngine.supported()) return;
    setReady(true);
    const savedOn = localStorage.getItem(PREF_KEY) === "1";
    const savedVol = Number(localStorage.getItem(VOL_KEY));
    if (!Number.isNaN(savedVol) && savedVol > 0) setVolume(savedVol);
    if (savedOn) setOn(true);
  }, []);

  // Autoplay policy: an AudioContext resumed inside a non-gesture effect can
  // stay suspended on some browsers, leaving the toggle "on" but silent. When
  // the user has music enabled, latch onto the first user gesture anywhere on
  // the page to (re)start the engine for real, then detach the listeners.
  useEffect(() => {
    if (!ready || !on) return;
    const kick = () => {
      engineRef.current?.start();
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
    window.addEventListener("pointerdown", kick, { once: false });
    window.addEventListener("keydown", kick, { once: false });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [ready, on]);

  // Sync the engine with the toggle state.
  useEffect(() => {
    if (!ready) return;
    if (!engineRef.current) {
      engineRef.current = new MusicEngine();
      engineRef.current.setVolume(volume);
    }
    const eng = engineRef.current;
    if (on) {
      eng.start();
    } else {
      eng.stop();
    }
  }, [on, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist volume + push to engine live.
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setVolume(volume);
  }, [volume]);

  const handleToggle = () => {
    const next = !on;
    setOn(next);
    localStorage.setItem(PREF_KEY, next ? "1" : "0");
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    localStorage.setItem(VOL_KEY, String(v));
  };

  if (!ready) return null;

  return (
    <div className="absolute top-[78px] left-0 z-30 anim-pop flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={on}
        aria-label={on ? "Mute music" : "Play music"}
        title={on ? "Mute music" : "Play music"}
        className={`flex items-center gap-1 min-w-[44px] px-2 py-1 rounded-r-lg border-y-2 border-r-2 border-black/50 text-center shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-all duration-300 ${
          on
            ? "bg-[#facc15] text-black border-[#b35900]"
            : "bg-black text-gray-400 border-white/20"
        }`}
      >
        <span className="font-pixel text-[8px] uppercase tracking-wider leading-none">
          {on ? "Mute" : "Music"}
        </span>
        <span className="font-pixel-fat text-sm leading-none">
          {on ? "♪" : "♪̸"}
        </span>
        {on && <span className="inline-flex gap-[1px] items-end h-3 ml-0.5">
          <span className="w-[2px] bg-black animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
          <span className="w-[2px] bg-black animate-pulse" style={{ height: "75%", animationDelay: "120ms" }} />
          <span className="w-[2px] bg-black animate-pulse" style={{ height: "55%", animationDelay: "240ms" }} />
        </span>}
      </button>

      {on && (
        <div className="ml-0 bg-black/80 border border-white/15 rounded-r-lg rounded-l-none px-2 py-1.5 flex items-center gap-1.5 shadow-[0_4px_10px_rgba(0,0,0,0.5)] anim-pop">
          <span className="font-pixel text-[7px] text-gray-400 leading-none">VOL</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            aria-label="Music volume"
            className="music-slider w-16 h-1 accent-[#facc15]"
          />
        </div>
      )}
    </div>
  );
}
