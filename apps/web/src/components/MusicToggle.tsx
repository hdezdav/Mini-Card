"use client";

import { useEffect, useRef, useState } from "react";
import { MusicEngine } from "@/lib/music";
import { dict, type Lang } from "@/lib/i18n";

// Floating music toggle — synthesizes an original procedural lounge-jazz loop
// with the Web Audio engine in @/lib/music. The music is generated in code, so it
// is fully copyright-free and works offline inside MiniPay / web3 browsers.
//
// Browser autoplay policy: AudioContext can only be created/resumed from a
// user gesture, so music never starts on its own. We restore the user's
// saved preference and start on first interaction (the toggle click counts).

const PREF_KEY = "minicard_music_enabled";
const VOL_KEY = "minicard_music_volume";

export function MusicToggle({ lang = "es" }: { lang?: Lang }) {
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
    <div className="absolute top-[148px] left-2.5 z-30 anim-pop flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        onMouseEnter={() => { if (on) { cancelHide(); setVolOpen(true); } }}
        onMouseLeave={() => on && armHide()}
        aria-pressed={on}
        aria-label={on ? dict.muteMusic[lang] : dict.playMusic[lang]}
        title={on ? dict.muteMusic[lang] : dict.playMusic[lang]}
        className={`group flex items-center justify-center gap-1.5 h-9 px-3 rounded-full border backdrop-blur-xl transition-all duration-200 active:scale-95 ${
          on
            ? "bg-[#ff9e2c]/90 hover:bg-[#ff9e2c] text-white border-[#ffe09e]/50 shadow-[0_4px_16px_rgba(255,158,44,0.5),0_0_12px_rgba(255,158,44,0.3)]"
            : "bg-[#1a0d3a]/85 hover:bg-[#261356] text-[#b8aeff] hover:text-white border-[#b026ff]/40 shadow-[0_4px_14px_rgba(176,38,255,0.35)]"
        }`}
      >
        {on ? (
          <svg className="w-4 h-4 fill-current drop-shadow-sm" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 fill-current opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
            <path d="M4.27 3L3 4.27l9 9v.28c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4v-1.73l4.27 4.27c-.85.47-1.84.73-2.9.73-3.31 0-6-2.69-6-6 0-1.06.26-2.05.73-2.9L1.39 2.22 2.66 1 20.78 19.12l-1.27 1.27L4.27 3zM14 7h4V3h-6v5.18l2 2V7z" />
          </svg>
        )}

        {on && (
          <span className="inline-flex gap-[2px] items-end h-3 ml-0.5">
            <span className="w-[2.5px] bg-white rounded-full animate-pulse" style={{ height: "45%", animationDelay: "0ms" }} />
            <span className="w-[2.5px] bg-white rounded-full animate-pulse" style={{ height: "85%", animationDelay: "140ms" }} />
            <span className="w-[2.5px] bg-white rounded-full animate-pulse" style={{ height: "60%", animationDelay: "280ms" }} />
          </span>
        )}
      </button>

      {on && (
        <div
          onMouseEnter={() => { cancelHide(); setVolOpen(true); }}
          onMouseLeave={() => on && armHide()}
          className={`backdrop-blur-xl bg-[#0a0420]/90 border border-[#00f0ff]/35 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.6),0_0_12px_rgba(0,240,255,0.15)] transition-all duration-300 origin-top-left ${
            volOpen
              ? "opacity-100 scale-100 max-h-10 mt-0"
              : "opacity-0 scale-90 max-h-0 -mt-2 pointer-events-none overflow-hidden"
          }`}
        >
          <span className="font-pixel text-[8px] text-[#00f0ff] leading-none uppercase tracking-wider">{dict.vol[lang]}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolume(Number(e.target.value))}
            onPointerDown={() => cancelHide()}
            onPointerUp={() => armHide()}
            aria-label={dict.musicVolume[lang]}
            className="music-slider w-16 h-1 accent-[#00f0ff] cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
