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

  // Volume slider visibility. When music is turned on we flash the slider so
  // the user can fine-tune, then auto-collapse it after a few seconds of
  // inactivity — "you already set the music, the control steps aside".
  // Hovering the toggle / slider, or dragging it, keeps it open.
  const [volOpen, setVolOpen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armHide = (delay = 2600) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVolOpen(false), delay);
  };
  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

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
    // Broadcast the master audio toggle so SFX (and anything else) can follow.
    window.dispatchEvent(new CustomEvent("minicard:audio", { detail: { on: next } }));
    if (next) {
      setVolOpen(true);
      armHide();
    } else {
      cancelHide();
      setVolOpen(false);
    }
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    localStorage.setItem(VOL_KEY, String(v));
  };

  // Clean up the hide timer on unmount.
  useEffect(() => () => cancelHide(), []);

  if (!ready) return null;

  return (
    <div className="absolute top-[150px] left-0 z-30 anim-pop flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={() => { if (on) { cancelHide(); setVolOpen(true); } }}
        onMouseLeave={() => on && armHide()}
        aria-pressed={on}
        aria-label={on ? "Mute music" : "Play music"}
        title={on ? "Mute music" : "Play music"}
        className={`flex items-center gap-1 min-w-[40px] px-2.5 py-1.5 rounded-r-lg rounded-l-none border-y-2 border-r-2 border-black/40 text-center transition-[transform,box-shadow] duration-75 active:translate-y-[2px] ${
          on
            ? "bg-[#f7931a] text-white shadow-[0_4px_0_#b35900,inset_0_2px_0_rgba(255,255,255,0.3)] active:shadow-[0_2px_0_#b35900,inset_0_2px_0_rgba(255,255,255,0.3)]"
            : "bg-[#3b4249] text-gray-300 shadow-[0_3px_0_#1e2226,inset_0_1px_0_rgba(255,255,255,0.15)] active:shadow-[0_1px_0_#1e2226,inset_0_1px_0_rgba(255,255,255,0.15)]"
        }`}
      >
        <span className="font-pixel-fat text-base leading-none txt-shadow">
          {on ? "♪" : "♪̸"}
        </span>
        {on && <span className="inline-flex gap-[1px] items-end h-3 ml-0.5">
          <span className="w-[2px] bg-white animate-pulse" style={{ height: "40%", animationDelay: "0ms" }} />
          <span className="w-[2px] bg-white animate-pulse" style={{ height: "75%", animationDelay: "120ms" }} />
          <span className="w-[2px] bg-white animate-pulse" style={{ height: "55%", animationDelay: "240ms" }} />
        </span>}
      </button>

      {on && (
        <div
          onMouseEnter={() => { cancelHide(); setVolOpen(true); }}
          onMouseLeave={() => on && armHide()}
          className={`bg-[#1a1d20] border-y-2 border-r-2 border-black/40 rounded-r-lg rounded-l-none px-2 py-1.5 flex items-center gap-1.5 shadow-[0_3px_0_#1e2226,inset_0_2px_4px_rgba(0,0,0,0.6)] transition-all duration-300 origin-top ${
            volOpen
              ? "opacity-100 scale-100 max-h-10 mt-0"
              : "opacity-0 scale-90 max-h-0 -mt-1.5 pointer-events-none overflow-hidden"
          }`}
        >
          <span className="font-pixel text-[7px] text-gray-400 leading-none uppercase tracking-wider">Vol</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            onPointerDown={() => cancelHide()}
            onPointerUp={() => armHide()}
            aria-label="Music volume"
            className="music-slider w-16 h-1 accent-[#facc15]"
          />
        </div>
      )}
    </div>
  );
}
