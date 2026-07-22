"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { HandType, JokerDef, JokerRarity } from "@/lib/game";

/* ═══════════════════════════════════════════
   i18n — English + Spanish for the Mini-Card home route.

   Spanish is the PRIMARY/default language. Detection only switches to
   English when the device language is English; every other locale keeps
   Spanish. The user's manual choice (EN|ES toggle) always wins and is
   persisted to localStorage under `minicard-lang`.
   ═══════════════════════════════════════════ */

export type Lang = "en" | "es";

export const LANG_KEY = "minicard-lang";

export interface Localized {
  en: string;
  es: string;
}

/** Automatic device language detection: checks navigator.languages and navigator.language.
 *  Returns "en" if device primary language is English, otherwise "es". */
export function detectLang(): Lang {
  if (typeof window === "undefined") return "es";
  const langs =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [
          navigator.language ||
            (navigator as unknown as { userLanguage?: string }).userLanguage ||
            "es",
        ];

  for (const l of langs) {
    if (!l) continue;
    const lower = l.toLowerCase();
    if (lower.startsWith("en")) return "en";
    if (lower.startsWith("es")) return "es";
  }
  return "es";
}

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

/** Provides the current locale + setter to all children. Holds the
 *  localStorage-backed state and the Spanish-primary auto-detection. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "es") {
      setLangState(saved);
    } else {
      setLangState(detectLang());
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* localStorage may be unavailable (private mode) — non-fatal */
    }
  }, []);

  return createElement(
    LangContext.Provider,
    { value: { lang, setLang } },
    children
  );
}

/** Consume the current locale + setter. Must be used inside <LangProvider>. */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used within a LangProvider");
  }
  return ctx;
}

/** Keep <html lang="..."> in sync with the chosen locale at runtime. */
export function useSyncHtmlLang(lang: Lang) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);
}

/** Replace `{token}` placeholders in a template string. */
export function fmt(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

/* ─── Home UI dictionary ─── */
export const dict = {
  // Top stats bar
  hands: { en: "Hands", es: "Manos" },
  discards: { en: "Discards", es: "Descartes" },
  round: { en: "Round", es: "Ronda" },
  ante: { en: "Ante", es: "Ante" },
  time: { en: "Time", es: "Tiempo" },
  money: { en: "Money", es: "Dinero" },

  // Sort controls
  sortHand: { en: "Sort Hand", es: "Ordenar mano" },
  rank: { en: "Rank", es: "Valor" },
  suit: { en: "Suit", es: "Palo" },

  // Primary action buttons
  runInfoL1: { en: "Run", es: "Run" },
  runInfoL2: { en: "Info", es: "Info" },
  leaderboard: { en: "Leaderboard", es: "Tabla" },
  playL1: { en: "Play", es: "Jugar" },
  playL2: { en: "Hand", es: "Mano" },
  discard: { en: "Discard", es: "Descartar" },
  liveStats: { en: "Live Stats", es: "Estadísticas" },
  nextBlind: { en: "Next Blind →", es: "Siguiente ciega →" },
  close: { en: "Close", es: "Cerrar" },
  closeCaps: { en: "CLOSE", es: "CERRAR" },

  // Score / hand panel
  roundScoreL1: { en: "Round", es: "Ronda" },
  roundScoreL2: { en: "score", es: "puntaje" },
  lvl: { en: "lvl.", es: "niv." },

  // Deck picker (RunInfo)
  deckTheme: { en: "— Deck Theme —", es: "— Tema de Mazo —" },
  deckDeck: { en: "{type} Deck", es: "Mazo {type}" },
  selectDeckBack: { en: "Select deck back style", es: "Elige el reverso" },
  deckBack: { en: "Deck Back", es: "Reverso" },

  // RunInfo panel
  runInfoTitle: { en: "RUN INFO", es: "INFO DE RUN" },
  activeJokers: { en: "— Active Jokers —", es: "— Jokers activos —" },
  handLevels: { en: "— Hand Levels —", es: "— Niveles de manos —" },

  // Shop
  shopTitle: { en: "SHOP", es: "TIENDA" },
  forSale: { en: "— For Sale —", es: "— En venta —" },
  conflictsWith: { en: "conflicts with {name}", es: "entra en conflicto con {name}" },
  boosterPacks: { en: "— Booster Packs —", es: "— Sobres —" },
  yourJokersSell: {
    en: "— Your Jokers (click to sell) —",
    es: "— Tus Jokers (clic para vender) —",
  },
  sellFor: { en: "Sell for ${amount}", es: "Vender por ${amount}" },
  packInfo: {
    en: "Each pack contains 1 random joker · $0.02 USDT",
    es: "Cada sobre trae 1 joker al azar · $0.02 USDT",
  },
  approving: { en: "Approving…", es: "Aprobando…" },
  opening: { en: "Opening…", es: "Abriendo…" },
  opened: { en: "Opened!", es: "¡Abierto!" },
  failed: { en: "Failed", es: "Falló" },
  duplicateRefund: {
    en: "Duplicate — refunded sell value",
    es: "Duplicado — valor de venta reembolsado",
  },
  newJokerAdded: { en: "New joker added!", es: "¡Nuevo joker añadido!" },
  approvalRejected: {
    en: "Approval rejected. Please confirm it in your wallet.",
    es: "Aprobación rechazada. Confírmala en tu wallet.",
  },
  couldNotOpen: {
    en: "Could not open pack. Please try again.",
    es: "No se pudo abrir el sobre. Inténtalo de nuevo.",
  },
  packOpenedUnreadable: {
    en: "Pack opened, but the result could not be read. Do not retry — check your packs later.",
    es: "Sobre abierto, pero no se pudo leer el resultado. No lo reintentes — revisa tus sobres más tarde.",
  },
  paymentFailed: {
    en: "Payment failed. Please try again.",
    es: "Pago fallido. Inténtalo de nuevo.",
  },
  unknownJokerId: { en: "Unknown joker ID: {id}", es: "ID de joker desconocido: {id}" },

  // Rarity names
  common: { en: "Common", es: "Común" },
  uncommon: { en: "Uncommon", es: "Poco común" },
  rare: { en: "Rare", es: "Raro" },
  legendary: { en: "Legendary", es: "Legendario" },
  commonPct: { en: "Common 60%", es: "Común 60%" },
  uncommonPct: { en: "Uncommon 25%", es: "Poco común 25%" },
  rarePct: { en: "Rare 12%", es: "Raro 12%" },
  legendaryPct: { en: "Legendary 3%", es: "Legendario 3%" },

  // Game over / cooldown
  cooldownActive: { en: "Cooldown Active", es: "Enfriamiento activo" },
  gameOver: { en: "Game Over", es: "Fin del juego" },
  roundScoreSummary: {
    en: "Round {round} — Score: {score}",
    es: "Ronda {round} — Puntaje: {score}",
  },
  submitting: { en: "SUBMITTING...", es: "ENVIANDO..." },
  saved: { en: "SAVED ✓", es: "GUARDADO ✓" },
  saveScore: { en: "SAVE SCORE", es: "GUARDAR PUNTAJE" },
  paying: { en: "PAYING...", es: "PAGANDO..." },
  playAgain: { en: "PLAY AGAIN", es: "JUGAR DE NUEVO" },
  playAgainBlue: { en: "Play Again", es: "Jugar de nuevo" },
  freePlayIn: { en: "Free play in:", es: "Juego gratis en:" },
  guestModeCooldown: {
    en: "Guest mode: Open this app inside MiniPay to pay and bypass, or wait 24h.",
    es: "Modo invitado: Abre la app dentro de MiniPay para pagar y saltarte la espera, o aguarda 24h.",
  },

  // Username gate
  registerUsername: { en: "REGISTER USERNAME", es: "REGISTRAR USUARIO" },
  usernameNeeded: {
    en: "You need a unique username to play and save your scores on the leaderboard.",
    es: "Necesitas un usuario único para jugar y guardar tus puntajes en la tabla.",
  },
  usernamePlaceholder: {
    en: "Choose a username (max 20)",
    es: "Elige un usuario (máx 20)",
  },
  registering: { en: "REGISTERING…", es: "REGISTRANDO…" },
  confirmUsername: { en: "CONFIRM USERNAME", es: "CONFIRMAR USUARIO" },
  usernameRegistersNote: {
    en: "This registers your username. You'll confirm it in your wallet.",
    es: "Esto registra tu usuario. Lo confirmarás en tu wallet.",
  },
  usernameEmpty: {
    en: "Username cannot be empty",
    es: "El usuario no puede estar vacío",
  },
  usernameTooLong: {
    en: "Username too long (max 20 chars)",
    es: "Usuario demasiado largo (máx 20 caracteres)",
  },
  registerFailed: {
    en: "Failed to register. Make sure you confirmed the registration.",
    es: "No se pudo registrar. Asegúrate de haber confirmado el registro.",
  },
  registrationFailed: {
    en: "Registration failed. Please try again.",
    es: "Registro fallido. Inténtalo de nuevo.",
  },

  // Leaderboard overlay
  leaderboardTitle: { en: "LEADERBOARD", es: "TABLA DE POSICIONES" },
  guest: { en: "Guest", es: "Invitado" },
  yourUsername: { en: "YOUR USERNAME:", es: "TU USUARIO:" },
  changeUsername: { en: "Change Username", es: "Cambiar usuario" },
  registerUniqueUsername: {
    en: "REGISTER UNIQUE USERNAME:",
    es: "REGISTRAR USUARIO ÚNICO:",
  },
  usernamePlaceholder2: {
    en: "Username (max 20 chars)",
    es: "Usuario (máx 20 caracteres)",
  },
  set: { en: "SET", es: "OK" },
  currentSessionScore: {
    en: "Current Session Score",
    es: "Puntaje de sesión actual",
  },
  submitScore: { en: "SUBMIT SCORE", es: "ENVIAR PUNTAJE" },
  loadingScores: { en: "LOADING SCORES...", es: "CARGANDO PUNTAJES..." },
  noScoresYet: { en: "NO SCORES YET", es: "SIN PUNTAJES AÚN" },
  colPlayer: { en: "PLAYER", es: "JUGADOR" },
  colRound: { en: "ROUND", es: "RONDA" },
  colScore: { en: "SCORE", es: "PUNTAJE" },
  playerN: { en: "Player {n}", es: "Jugador {n}" },
  usernameSetSuccess: {
    en: "Username set successfully!",
    es: "¡Usuario establecido con éxito!",
  },
  setUsernameFailed: {
    en: "Failed to set username. Make sure you confirmed the registration and have a small network fee in USDT.",
    es: "No se pudo establecer el usuario. Asegúrate de haber confirmado el registro y tener una pequeña comisión de red en USDT.",
  },

  // Alerts / toasts (shown via window.alert)
  openInMinipay: {
    en: "Open this app inside MiniPay to save your score to the global leaderboard.",
    es: "Abre la app dentro de MiniPay para guardar tu puntaje en la tabla global.",
  },
  scoreSavedSuccess: {
    en: "Score successfully saved to the global leaderboard!",
    es: "¡Puntaje guardado en la tabla global!",
  },
  submitFailed: {
    en: "Failed to submit score. Make sure you confirmed the submission in your wallet.",
    es: "No se pudo enviar el puntaje. Asegúrate de haber confirmado el envío en tu wallet.",
  },
  scoreSaveError: { en: "Error saving your score.", es: "Error al guardar tu puntaje." },
  paymentRejected: {
    en: "Payment was rejected. Please confirm the payment to play again.",
    es: "Pago rechazado. Confirma el pago para jugar de nuevo.",
  },

  // Blind token (two-line label)
  bossBlind: { en: "BOSS\nBLIND", es: "JEFE\nCIEGA" },
  bigBlind: { en: "BIG\nBLIND", es: "GRAN\nCIEGA" },
  smlBlind: { en: "SML\nBLIND", es: "PEQ\nCIEGA" },

  // A11y
  blindProgress: {
    en: "Blind progress: {pct}%",
    es: "Progreso de ciega: {pct}%",
  },

  // Music toggle
  muteMusic: { en: "Mute music", es: "Silenciar música" },
  playMusic: { en: "Play music", es: "Reproducir música" },
  musicVolume: { en: "Music volume", es: "Volumen de música" },
  vol: { en: "Vol", es: "Vol" },

  // Cards
  cardBack: { en: "Card Back", es: "Reverso" },
  cardOf: { en: "{rank} of {suit}", es: "{rank} de {suit}" },
  empty: { en: "EMPTY", es: "VACÍO" },

  // Language toggle
  langEn: { en: "EN", es: "EN" },
  langEs: { en: "ES", es: "ES" },
  language: { en: "Language", es: "Idioma" },
} satisfies Record<string, Localized>;

export type DictKey = keyof typeof dict;

/* ─── Poker hand names (standard Spanish poker terms) ─── */
export const HAND_NAME: Record<HandType, Localized> = {
  "High Card": { en: "High Card", es: "Carta Alta" },
  Pair: { en: "Pair", es: "Pareja" },
  "Two Pair": { en: "Two Pair", es: "Doble Pareja" },
  "Three of a Kind": { en: "Three of a Kind", es: "Trío" },
  Straight: { en: "Straight", es: "Escalera" },
  Flush: { en: "Flush", es: "Color" },
  "Full House": { en: "Full House", es: "Full House" },
  "Four of a Kind": { en: "Four of a Kind", es: "Póker" },
  "Straight Flush": { en: "Straight Flush", es: "Escalera de Color" },
  "Royal Flush": { en: "Royal Flush", es: "Escalera Real" },
  "Five of a Kind": { en: "Five of a Kind", es: "Cinco Iguales" },
  "Flush House": { en: "Flush House", es: "Full de Color" },
  "Flush Five": { en: "Flush Five", es: "Color de Cinco" },
};

export function handName(type: HandType, lang: Lang): string {
  return HAND_NAME[type][lang];
}

/* ─── Suit names (for card alt text) ─── */
export const SUIT_NAME: Record<string, Localized> = {
  spades: { en: "spades", es: "picas" },
  hearts: { en: "hearts", es: "corazones" },
  diamonds: { en: "diamonds", es: "diamantes" },
  clubs: { en: "clubs", es: "tréboles" },
};

export function suitName(suit: string, lang: Lang): string {
  return (SUIT_NAME[suit] ?? { en: suit, es: suit })[lang];
}

/* ─── Joker Spanish names + descriptions (parallel to JOKER_DEFS in game.ts).
   game.ts is off-limits, so Spanish counterparts live here and display logic
   routes through jokerName()/jokerDesc(). English stays the source of truth
   in game.ts. ─── */
export const jokerEs: Record<number, { name: string; desc: string }> = {
  1: { name: "Joker", desc: "+2 Mult" },
  2: { name: "Codicioso", desc: "+2 Mult si la mano tiene un ♦" },
  3: { name: "Lujurioso", desc: "+2 Mult si la mano tiene un ♥" },
  4: { name: "Colérico", desc: "+2 Mult si la mano tiene un ♠" },
  5: { name: "Glotón", desc: "+2 Mult si la mano tiene un ♣" },
  6: { name: "Alegre", desc: "+5 Mult si la mano contiene una Pareja" },
  7: { name: "Loco", desc: "+8 Mult si la mano contiene un Trío" },
  8: { name: "Truco", desc: "+20 Fichas por cada 2,3,4,5 en la mano" },
  9: { name: "Astuto", desc: "+30 Fichas si la mano es una Pareja" },
  10: { name: "Mitad", desc: "+10 Mult si la mano tiene 3 cartas o menos" },
  11: { name: "Estandarte", desc: "+15 Fichas por descarte restante" },
  12: { name: "Cumbre Mística", desc: "+8 Mult cuando quedan 0 descartes" },
  13: { name: "Carta Dorada", desc: "+15 Mult y +50 Fichas" },
  14: { name: "Toque de Midas", desc: "+20 Mult y +20 Fichas" },
  15: { name: "El Prisma", desc: "x3.0 Mult" },
  16: { name: "Infinito", desc: "+100 Fichas y x2.0 Mult" },
  17: {
    name: "Pacto de Sangre",
    desc: "x3 Mult, pero pierdes $5 si puntúa un ♥",
  },
  18: {
    name: "Deuda de Diamantes",
    desc: "x2.5 Mult, pero pierdes $2 por cada ♦ que puntúe",
  },
  19: {
    name: "Moneda Maldita",
    desc: "+$6 por mano jugada, pero Mult x0.75",
  },
  20: {
    name: "Cañón de Cristal",
    desc: "x4 Mult, pero pierdes $10 a 0 descartes",
  },
  21: {
    name: "Pacto del Vacío",
    desc: "x2.5 Mult, pero ♠/♣ no suman fichas",
  },
  22: {
    name: "Filo Carmesí",
    desc: "x2 Mult y +30 Fichas por cada ♥ que puntúe",
  },
  23: {
    name: "Filo Obsidiana",
    desc: "x2 Mult y +30 Fichas por cada ♠ que puntúe",
  },
};

export function jokerName(def: JokerDef, lang: Lang): string {
  return lang === "es" ? (jokerEs[def.id]?.name ?? def.name) : def.name;
}

export function jokerDesc(def: JokerDef, lang: Lang): string {
  return lang === "es" ? (jokerEs[def.id]?.desc ?? def.desc) : def.desc;
}

/* ─── Rarity display names ─── */
export function rarityName(rarity: JokerRarity, lang: Lang): string {
  switch (rarity) {
    case "common":
      return dict.common[lang];
    case "uncommon":
      return dict.uncommon[lang];
    case "rare":
      return dict.rare[lang];
    case "legendary":
      return dict.legendary[lang];
  }
}
