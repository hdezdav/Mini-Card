// Synthwave rarity color map — single source of truth.
// KEEP IN SYNC with the .rarity-* classes in apps/web/src/app/globals.css.
// Used by Shop.tsx and RunInfo.tsx (previously duplicated in both).

export const RARITY_COLOR: Record<string, string> = {
  common: "#b8aeff",
  uncommon: "#00f0ff",
  rare: "#ff2e88",
  legendary: "#ff9e2c",
};
