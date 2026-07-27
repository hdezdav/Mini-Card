"use client";

import { useState } from "react";
import { dict, type Lang } from "@/lib/i18n";

interface TutorialProps {
  lang: Lang;
  onClose: () => void;
}

export function Tutorial({ lang, onClose }: TutorialProps) {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: lang === "es" ? "CÓMO JUGAR: CHIPS × MULT" : "HOW TO PLAY: CHIPS × MULT",
      badge: lang === "es" ? "Slide 1 / 4 — La Ecuación" : "Slide 1 / 4 — The Formula",
      color: "#00f0ff",
      content: (
        <div className="flex flex-col gap-3 text-center items-center">
          <p className="font-pixel text-xs text-gray-300 leading-relaxed">
            {lang === "es"
              ? "Cada jugada calcula tu puntaje multiplicando Fichas (Chips) por el Multiplicador (Mult)."
              : "Every hand played scores points by multiplying Chips by the Multiplier (Mult)."}
          </p>

          <div className="bg-[#0a0420] border border-[#00f0ff]/40 rounded-xl p-3 w-full flex items-center justify-center gap-2 shadow-lg">
            <div className="flex flex-col items-center">
              <span className="font-pixel text-[10px] text-gray-400">CHIPS</span>
              <span className="font-pixel-fat text-lg text-[#00f0ff]">120</span>
            </div>
            <span className="font-pixel-fat text-[#ff2e88] text-xl">×</span>
            <div className="flex flex-col items-center">
              <span className="font-pixel text-[10px] text-gray-400">MULT</span>
              <span className="font-pixel-fat text-lg text-[#ff2e88]">12</span>
            </div>
            <span className="font-pixel-fat text-white text-xl">=</span>
            <div className="flex flex-col items-center">
              <span className="font-pixel text-[10px] text-gray-400">PUNTAJE</span>
              <span className="font-pixel-fat text-lg text-[#ff9e2c]">1,440</span>
            </div>
          </div>

          <ul className="text-left font-pixel text-[11px] text-gray-300 space-y-1.5 w-full bg-black/40 p-2.5 rounded-lg border border-white/5">
            <li className="flex items-start gap-1.5">
              <span className="text-[#00f0ff]">✦</span>
              <span>
                {lang === "es"
                  ? "Las cartas jugadas aportan Fichas según su valor (As=11, Figuras=10, 2-10=valor)."
                  : "Played cards add Chips based on rank (Ace=11, Face cards=10, 2-10=rank)."}
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#ff2e88]">✦</span>
              <span>
                {lang === "es"
                  ? "Las manos de póker más difíciles (Color, Escalera, Full) dan Fichas y Mults base más altos."
                  : "Harder poker hands (Flush, Straight, Full House) grant higher base Chips & Mult."}
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: lang === "es" ? "PODER JOKER" : "JOKER POWER",
      badge: lang === "es" ? "Slide 2 / 4 — Sinergias" : "Slide 2 / 4 — Synergies",
      color: "#ff2e88",
      content: (
        <div className="flex flex-col gap-3 text-center items-center">
          <p className="font-pixel text-xs text-gray-300 leading-relaxed">
            {lang === "es"
              ? "Puedes equipar hasta 5 Jokers que modifican el puntaje con efectos pasivos destructivos."
              : "Equip up to 5 Jokers that modify scoring with powerful passive effects."}
          </p>

          <div className="grid grid-cols-3 gap-1.5 w-full">
            <div className="panel p-2 rounded-lg flex flex-col items-center text-center">
              <span className="text-lg">🃏</span>
              <span className="font-pixel-fat text-[10px] text-[#00f0ff] mt-0.5">+40 Fichas</span>
              <span className="font-pixel text-[8px] text-gray-400 leading-none mt-1">
                {lang === "es" ? "Por Par" : "Per Pair"}
              </span>
            </div>
            <div className="panel p-2 rounded-lg flex flex-col items-center text-center">
              <span className="text-lg">🔥</span>
              <span className="font-pixel-fat text-[10px] text-[#ff2e88] mt-0.5">+15 Mult</span>
              <span className="font-pixel text-[8px] text-gray-400 leading-none mt-1">
                {lang === "es" ? "En Color" : "Per Flush"}
              </span>
            </div>
            <div className="panel p-2 rounded-lg flex flex-col items-center text-center">
              <span className="text-lg">⚡</span>
              <span className="font-pixel-fat text-[10px] text-[#ff9e2c] mt-0.5">×3 Mult</span>
              <span className="font-pixel text-[8px] text-gray-400 leading-none mt-1">
                {lang === "es" ? "Multiplicativo" : "Multiplicative"}
              </span>
            </div>
          </div>

          <p className="font-pixel text-[11px] text-[#a78bfa] bg-black/40 p-2 rounded-lg border border-[#a78bfa]/20 w-full">
            {lang === "es"
              ? "💡 Tip: Los Jokers se activan de izquierda a derecha. ¡Pon los Jokers multiplicativos (xMult) al final!"
              : "💡 Tip: Jokers trigger left-to-right. Place multiplicative Jokers (xMult) on the far right!"}
          </p>
        </div>
      ),
    },
    {
      title: lang === "es" ? "NIVELES Y TIENDA" : "LEVELS & SHOP",
      badge: lang === "es" ? "Slide 3 / 4 — Progresión" : "Slide 3 / 4 — Progression",
      color: "#ff9e2c",
      content: (
        <div className="flex flex-col gap-3 text-center items-center">
          <p className="font-pixel text-xs text-gray-300 leading-relaxed">
            {lang === "es"
              ? "Sube de nivel tus manos y compra mejoras en la Tienda entre rondas."
              : "Level up your hands and buy upgrades in the Shop between rounds."}
          </p>

          <div className="flex gap-2 w-full">
            <div className="panel p-2.5 rounded-xl flex-1 flex flex-col items-center text-center">
              <span className="font-pixel-fat text-xs text-[#00f0ff] mb-1">
                {lang === "es" ? "Niveles de Mano" : "Hand Levels"}
              </span>
              <p className="font-pixel text-[9.5px] text-gray-300 leading-tight">
                {lang === "es"
                  ? "Cada vez que juegas un tipo de mano, ¡sube de nivel para siempre!"
                  : "Every hand played levels up permanently for the run!"}
              </p>
            </div>
            <div className="panel p-2.5 rounded-xl flex-1 flex flex-col items-center text-center">
              <span className="font-pixel-fat text-xs text-[#ff9e2c] mb-1">
                {lang === "es" ? "Tienda & Sobres" : "Shop & Packs"}
              </span>
              <p className="font-pixel text-[9.5px] text-gray-300 leading-tight">
                {lang === "es"
                  ? "Gana dinero por ganar rondas y manos sobrantes para comprar Jokers."
                  : "Earn cash from winning rounds to buy new Jokers and open packs."}
              </p>
            </div>
          </div>

          <div className="bg-[#0a0420] border border-white/10 rounded-lg p-2 w-full flex items-center justify-between text-xs font-pixel">
            <span className="text-gray-400">{lang === "es" ? "Mano Nivel 2:" : "Hand Level 2:"}</span>
            <span className="text-[#00f0ff] font-pixel-fat">+15 Fichas</span>
            <span className="text-[#ff2e88] font-pixel-fat">+2 Mult</span>
          </div>
        </div>
      ),
    },
    {
      title: lang === "es" ? "JEFE CIEGO Y ANTES" : "BOSS BLINDS & ANTES",
      badge: lang === "es" ? "Slide 4 / 4 — Desafíos" : "Slide 4 / 4 — Bosses",
      color: "#a78bfa",
      content: (
        <div className="flex flex-col gap-3 text-center items-center">
          <p className="font-pixel text-xs text-gray-300 leading-relaxed">
            {lang === "es"
              ? "Supera 8 Antes (24 Rondas). En cada 3ra ronda, enfrenta a un Jefe Ciego con reglas especiales."
              : "Defeat 8 Antes (24 Rounds). Every 3rd round, face a Boss Blind with unique constraints."}
          </p>

          <div className="bg-black/50 border border-[#ff2e88]/50 rounded-xl p-2.5 w-full flex flex-col gap-1.5 text-left font-pixel text-[10.5px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="text-[#ff2e88] font-pixel-fat">👁️ {lang === "es" ? "La Psíquica" : "The Psychic"}</span>
              <span className="text-gray-400">{lang === "es" ? "Debes jugar 5 cartas" : "Must play 5 cards"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <span className="text-[#ff9e2c] font-pixel-fat">🗡️ {lang === "es" ? "La Aguja" : "The Needle"}</span>
              <span className="text-gray-400">{lang === "es" ? "Solo 1 mano esta ronda" : "Play only 1 hand"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#00f0ff] font-pixel-fat">🌊 {lang === "es" ? "El Agua" : "The Water"}</span>
              <span className="text-gray-400">{lang === "es" ? "0 Descartes disponibles" : "0 Discards allowed"}</span>
            </div>
          </div>

          <p className="font-pixel text-xs text-[#00f0ff] font-bold">
            {lang === "es" ? "¡Logra el puntaje objetivo antes de quedarte sin manos!" : "Reach target score before running out of hands!"}
          </p>
        </div>
      ),
    },
  ];

  const current = slides[slide];

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (slide > 0) {
      setSlide((s) => s - 1);
    }
  };

  const handleFinish = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("minicard_tutorial_seen", "1");
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fadeIn">
      <div
        className="panel anim-pop rounded-2xl p-5 w-full max-w-[340px] flex flex-col justify-between shadow-2xl border-2"
        style={{ borderColor: current.color }}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span
              className="font-pixel text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/40 border border-white/10"
              style={{ color: current.color }}
            >
              {current.badge}
            </span>
            <button
              type="button"
              onClick={handleFinish}
              className="font-pixel text-[10px] text-gray-400 hover:text-white transition-colors"
            >
              {lang === "es" ? "Saltar ✕" : "Skip ✕"}
            </button>
          </div>
          <h2 className="font-pixel-fat text-xl txt-chrome text-center my-2">
            {current.title}
          </h2>
        </div>

        {/* Slide Body */}
        <div className="my-2 min-h-[190px] flex items-center">{current.content}</div>

        {/* Footer & Controls */}
        <div className="flex flex-col gap-3 mt-2">
          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === slide ? "w-5 bg-[#00f0ff]" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            {slide > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="btn-chunky btn-orange flex-1 py-2 text-xs"
              >
                {lang === "es" ? "Anterior" : "Previous"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="btn-chunky btn-red flex-1 py-2 text-xs"
              >
                {lang === "es" ? "Saltar" : "Skip"}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="btn-chunky btn-blue flex-1 py-2 text-xs font-bold"
            >
              {slide === slides.length - 1
                ? lang === "es"
                  ? "¡A Jugar! 🎮"
                  : "Let's Play! 🎮"
                : lang === "es"
                ? "Siguiente →"
                : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
