"use client";

import { useEffect, useRef, useState } from "react";
import { MusicEngine } from "@/lib/music";

// Floating music toggle — synthesizes an original procedural lounge-jazz loop
// with the Web Audio engine in @/lib/music. The music is generated in code, so it
// is fully copyright-free and works offline inside MiniPay / web3 browsers.
//
// Browser autoplay policy: AudioContext can only be created/resumed from a
// user gesture, so music never starts on its own. We restore the user's
// saved preference and start on first interaction (the toggle click counts).

const PREF_KEY = "minicard_music_enabled";
const VOL_KEY = "minicard_music_volume";

export function MusicToggle() {
  const engineRef = useRef<MusicEngine | null>(null);
  const startRef = useRef<Promise<boolean> | null>(null);
  const intentRef = useRef(0);
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [pendingRestore, setPendingRestore] = useState(false);

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
    if (savedOn) setPendingRestore(true);
  }, []);

  const startFromGesture = () => {
    if (startRef.current) return startRef.current;
    const engine = engineRef.current ?? new MusicEngine();
    engineRef.current = engine;
    engine.setVolume(volume);
    const intent = ++intentRef.current;
    const start = engine.start().then((success) => {
      if (success && intent === intentRef.current) {
        setOn(true);
        setPendingRestore(false);
        localStorage.setItem(PREF_KEY, "1");
        window.dispatchEvent(new CustomEvent("minicard:audio", { detail: { on: true } }));
        setVolOpen(true);
        armHide();
      }
      return success;
    }).finally(() => {
      startRef.current = null;
    });
    startRef.current = start;
    return start;
  };

  // A restored preference is only an intent. The first explicit gesture gets
  // the engine through autoplay policy and removes these listeners on success.
  useEffect(() => {
    if (!ready || !pendingRestore) return;
    const kick = () => { void startFromGesture(); };
    window.addEventListener("pointerdown", kick);
    window.addEventListener("keydown", kick);
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [ready, pendingRestore, volume]);

  // Persist volume + push to engine live.
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setVolume(volume);
  }, [volume]);

  const handleToggle = () => {
    if (on) {
      ++intentRef.current;
      engineRef.current?.stop();
      setOn(false);
      setPendingRestore(false);
      localStorage.setItem(PREF_KEY, "0");
      window.dispatchEvent(new CustomEvent("minicard:audio", { detail: { on: false } }));
      cancelHide();
      setVolOpen(false);
      return;
    }
    void startFromGesture();
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    localStorage.setItem(VOL_KEY, String(v));
  };

  // Release timers, scheduled voices, and the AudioContext on unmount.
  useEffect(() => () => {
    cancelHide();
    engineRef.current?.dispose();
    engineRef.current = null;
  }, []);

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
            ? "bg-[#ff9e2c] text-white shadow-[0_4px_0_#b35900,inset_0_2px_0_rgba(255,255,255,0.3),0_0_12px_rgba(255,158,44,0.5)] active:shadow-[0_2px_0_#b35900,inset_0_2px_0_rgba(255,255,255,0.3),0_0_8px_rgba(255,158,44,0.4)]"
            : "bg-[#1a0d3a] text-[#b8aeff] shadow-[0_3px_0_#0a0420,inset_0_1px_0_rgba(255,255,255,0.15),0_0_8px_rgba(176,38,255,0.25)] active:shadow-[0_1px_0_#0a0420,inset_0_1px_0_rgba(255,255,255,0.15)]"
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
          className={`bg-[#0a0420] border-y-2 border-r-2 border-black/40 rounded-r-lg rounded-l-none px-2 py-1.5 flex items-center gap-1.5 shadow-[0_3px_0_#0a0420,inset_0_2px_4px_rgba(0,0,0,0.7),inset_0_0_8px_rgba(0,240,255,0.08)] transition-all duration-300 origin-top ${
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
            className="music-slider w-16 h-1 accent-[#00f0ff]"
          />
        </div>
      )}
    </div>
  );
}
