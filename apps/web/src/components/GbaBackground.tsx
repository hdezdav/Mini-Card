"use client";

import { useEffect, useRef } from "react";
import { type BlindKind } from "@/lib/game";

interface GbaBackgroundProps {
  blindKind: BlindKind | "shop" | "lost";
  phase?: string;
}

export function GbaBackground({ blindKind, phase }: GbaBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const rawCanvas = canvasRef.current;
    if (!rawCanvas) return;
    const canvas: HTMLCanvasElement = rawCanvas;

    const rawCtx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;

    const TAU = Math.PI * 2;
    const LOOP = 16;

    // device / quality detection
    const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent);
    const smallScreen = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
    const QUALITY = (isMobile || smallScreen) ? "low" : "high";

    let currentQuality = QUALITY;
    
    // Quality presets optimized for low CPU usage and zero-acceleration environments
    const presets = {
      ultra: {
        dprMax: 1.0,
        terrainRows: 10,
        terrainCols: 6,
        starCount: 15,
        nebulaCount: 0,
        glowScale: 0.0,
        scanlines: false,
        palmCount: 2,
        roadSegments: 15,
        pyramidLines: 3,
        skipFrames: 2,
      },
      low: {
        dprMax: 1.0,
        terrainRows: 18,
        terrainCols: 10,
        starCount: 40,
        nebulaCount: 1,
        glowScale: 0.0,
        scanlines: false,
        palmCount: 4,
        roadSegments: 30,
        pyramidLines: 5,
        skipFrames: 1,
      },
      high: {
        dprMax: 1.5, // Capped to 1.5 (down from 2) to protect pixel fillrate on Retina/High-DPI
        terrainRows: 32, // Reduced from 40 for a free 20% speedup
        terrainCols: 18, // Reduced from 22
        starCount: 120, // Reduced from 200 (less arcs)
        nebulaCount: 4, // Reduced from 6 (less radial gradients)
        glowScale: 0.8, // Slightly reduced to save shadowBlur blur radius costs
        scanlines: true,
        palmCount: 6,
        roadSegments: 50, // Reduced from 80
        pyramidLines: 7,
        skipFrames: 1,
      }
    };

    let Q = { ...presets[currentQuality as keyof typeof presets] };

    const skyCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const skyCtx = skyCanvas ? skyCanvas.getContext("2d") : null;
    let skyCached = false;

    const sunCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const sunCtx = sunCanvas ? sunCanvas.getContext("2d") : null;

    let frameTimes: number[] = [];
    const maxFrameHistory = 60;
    let lastPerformanceCheck = performance.now();
    let frameCount = 0;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let horizon = 0;
    const start = performance.now();

    const grain = typeof document !== "undefined" ? document.createElement("canvas") : null;
    const grainCtx = grain ? grain.getContext("2d") : null;
    const stars: Array<{ x: number; y: number; r: number; a: number; p: number; speed: number }> = [];
    const nebulaSeeds: Array<{ x: number; y: number; r: number; hue: "magenta" | "purple"; p: number }> = [];

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const ease = (t: number) => t * t * (3 - 2 * t);
    const loopSin = (t: number, ph = 0) => Math.sin(TAU * (t / LOOP + ph));
    const loopCos = (t: number, ph = 0) => Math.cos(TAU * (t / LOOP + ph));

    const parseRGBAlpha = (colorStr: string, alphaVal: number) => {
      if (colorStr.startsWith("#")) {
        let hex = colorStr.slice(1);
        if (hex.length === 3) {
          hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alphaVal})`;
      }
      const parts = colorStr.match(/\d+/g);
      if (!parts || parts.length < 3) return "rgba(0,0,0,0)";
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alphaVal})`;
    };

    // Dynamic theme color configurations mapping to gameplay states
    const themes = {
      small: {
        skyTop: "rgb(20, 0, 60)",
        skyMid1: "rgb(43, 0, 89)",
        skyMid2: "rgb(75, 0, 130)",
        skyMid3: "rgb(145, 16, 150)",
        skyMid4: "rgb(209, 0, 118)",
        skyMid5: "rgb(255, 0, 127)",
        skyBot: "rgb(255, 59, 0)",
        sunColor1: "#ffd27a",
        sunColor2: "#ff9e2c",
        sunColor3: "#ff2e88",
        gridMagenta: "rgba(180, 50, 255, 0.55)",
        gridCyan: "rgba(0, 255, 255, 0.45)",
        nebulaColor1: "rgba(255, 80, 180, 0.07)",
        nebulaColor2: "rgba(180, 40, 200, 0.035)",
        roadColor1: "#0e0612",
        roadColor2: "#080510",
        roadColor3: "#020104",
      },
      big: {
        skyTop: "rgb(25, 0, 65)",
        skyMid1: "rgb(55, 0, 95)",
        skyMid2: "rgb(90, 0, 130)",
        skyMid3: "rgb(175, 10, 130)",
        skyMid4: "rgb(230, 20, 90)",
        skyMid5: "rgb(255, 75, 20)",
        skyBot: "rgb(255, 158, 44)",
        sunColor1: "#ffe09a",
        sunColor2: "#ff9e2c",
        sunColor3: "#ff2e88",
        gridMagenta: "rgba(176, 38, 255, 0.55)",
        gridCyan: "rgba(255, 158, 44, 0.45)",
        nebulaColor1: "rgba(255, 140, 60, 0.06)",
        nebulaColor2: "rgba(180, 40, 200, 0.03)",
        roadColor1: "#120718",
        roadColor2: "#0a0410",
        roadColor3: "#030105",
      },
      boss: {
        skyTop: "rgb(15, 0, 10)",
        skyMid1: "rgb(35, 0, 12)",
        skyMid2: "rgb(65, 0, 15)",
        skyMid3: "rgb(115, 0, 25)",
        skyMid4: "rgb(185, 0, 35)",
        skyMid5: "rgb(230, 0, 40)",
        skyBot: "rgb(255, 60, 0)",
        sunColor1: "#ffbfa3",
        sunColor2: "#ff3b3b",
        sunColor3: "#b00020",
        gridMagenta: "rgba(255, 46, 44, 0.6)",
        gridCyan: "rgba(255, 110, 0, 0.45)",
        nebulaColor1: "rgba(255, 46, 44, 0.07)",
        nebulaColor2: "rgba(180, 0, 20, 0.035)",
        roadColor1: "#100204",
        roadColor2: "#080102",
        roadColor3: "#020001",
      },
      shop: {
        skyTop: "rgb(0, 15, 45)",
        skyMid1: "rgb(5, 30, 75)",
        skyMid2: "rgb(15, 50, 110)",
        skyMid3: "rgb(50, 20, 120)",
        skyMid4: "rgb(110, 10, 130)",
        skyMid5: "rgb(180, 30, 170)",
        skyBot: "rgb(0, 240, 255)",
        sunColor1: "#e0ffff",
        sunColor2: "#00f0ff",
        sunColor3: "#b026ff",
        gridMagenta: "rgba(160, 46, 255, 0.55)",
        gridCyan: "rgba(0, 240, 255, 0.45)",
        nebulaColor1: "rgba(0, 240, 255, 0.07)",
        nebulaColor2: "rgba(120, 60, 220, 0.035)",
        roadColor1: "#020b1c",
        roadColor2: "#010512",
        roadColor3: "#000104",
      },
      lost: {
        skyTop: "rgb(10, 5, 15)",
        skyMid1: "rgb(20, 8, 25)",
        skyMid2: "rgb(35, 12, 40)",
        skyMid3: "rgb(55, 15, 50)",
        skyMid4: "rgb(85, 20, 65)",
        skyMid5: "rgb(115, 22, 70)",
        skyBot: "rgb(130, 30, 45)",
        sunColor1: "#ff99aa",
        sunColor2: "#b01e2c",
        sunColor3: "#45050b",
        gridMagenta: "rgba(130, 30, 45, 0.45)",
        gridCyan: "rgba(80, 10, 20, 0.35)",
        nebulaColor1: "rgba(115, 22, 70, 0.04)",
        nebulaColor2: "rgba(55, 15, 50, 0.02)",
        roadColor1: "#0b0507",
        roadColor2: "#060203",
        roadColor3: "#020101",
      },
    };

    function buildGrain() {
      if (!grain || !grainCtx) return;
      const gw = 220;
      const gh = gw;
      grain.width = gw;
      grain.height = gh;
      const img = grainCtx.createImageData(gw, gh);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = 100 + Math.random() * 140;
        img.data[i] = n;
        img.data[i + 1] = n;
        img.data[i + 2] = n;
        img.data[i + 3] = 14 + Math.random() * 26;
      }
      grainCtx.putImageData(img, 0, 0);
    }

    function buildStars() {
      stars.length = 0;
      for (let i = 0; i < Q.starCount; i++) {
        stars.push({
          x: Math.random(),
          y: Math.random() * 0.52,
          r: Math.pow(Math.random(), 2.5) * 1.6 + 0.3,
          a: Math.random() * 0.7 + 0.3,
          p: Math.random(),
          speed: 0.5 + Math.random() * 1.5,
        });
      }
    }

    function buildNebula() {
      nebulaSeeds.length = 0;
      for (let i = 0; i < Q.nebulaCount; i++) {
        nebulaSeeds.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.05 + Math.random() * 0.32,
          r: 0.08 + Math.random() * 0.14,
          hue: Math.random() < 0.5 ? "magenta" : "purple",
          p: Math.random(),
        });
      }
    }

    function resize() {
      if (!canvas || !ctx) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, Q.dprMax);
      w = parent.clientWidth | 0;
      h = parent.clientHeight | 0;
      canvas.width = (w * dpr) | 0;
      canvas.height = (h * dpr) | 0;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      horizon = h * 0.55;
      skyCached = false;
      if (currentQuality === "high") {
        buildGrain();
      }
      buildStars();
      buildNebula();
    }

    function terrainHeight(xn: number, z: number, time: number) {
      const sideWeight = Math.pow(Math.abs(xn), 1.6);
      const w1 = Math.sin(xn * 2.9 + z * 9.0 - time * 0.9) * 0.6;
      const w2 = Math.sin(xn * 5.1 + z * 14.0 - time * 0.6) * 0.25;
      const w3 = Math.sin(xn * 1.3 + z * 5.0 + time * 0.3) * 0.15;
      return (w1 + w2 + w3) * sideWeight;
    }

    function projectTerrain(xn: number, z: number, time: number) {
      const zz = clamp(z, 0, 1);
      const spread = w * (0.05 + zz * 1.08);
      const baseY = lerp(horizon, h * 1.18, Math.pow(zz, 1.78));
      const amp = h * (0.016 + zz * 0.05);
      const wave = terrainHeight(xn, zz, time) * amp * Math.pow(zz, 0.86);
      return { x: w * 0.5 + xn * spread, y: baseY - wave, h: wave };
    }

    function roadX(side: number, z: number) {
      return w * 0.5 + side * lerp(w * 0.038, w * 0.40, Math.pow(z, 1.55));
    }
    function roadY(z: number) {
      return lerp(horizon, h * 1.17, Math.pow(z, 1.7));
    }

    function glowStroke(color: string, lw: number, blur: number, alpha = 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.globalAlpha = alpha;
      if (Q.glowScale > 0 && blur > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = blur * Q.glowScale;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    function drawSky(t: number, p: number, theme: typeof themes.small) {
      if ((currentQuality === "low" || currentQuality === "ultra") && skyCanvas && skyCtx) {
        if (!skyCached) {
          skyCanvas.width = w;
          skyCanvas.height = h;

          const grad = skyCtx.createLinearGradient(0, 0, 0, h);
          const parseRGB = (rgbStr: string) => {
            const parts = rgbStr.match(/\d+/g);
            return parts ? parts.map(Number) : [0, 0, 0];
          };
          const toRGB = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
          
          grad.addColorStop(0.00, toRGB(parseRGB(theme.skyTop)));
          grad.addColorStop(0.18, toRGB(parseRGB(theme.skyMid1)));
          grad.addColorStop(0.32, toRGB(parseRGB(theme.skyMid2)));
          grad.addColorStop(0.45, toRGB(parseRGB(theme.skyMid3)));
          grad.addColorStop(0.52, toRGB(parseRGB(theme.skyMid4)));
          grad.addColorStop(0.54, toRGB(parseRGB(theme.skyMid5)));
          grad.addColorStop(0.545, toRGB(parseRGB(theme.skyBot)));
          grad.addColorStop(0.56, "#0a0014");
          grad.addColorStop(1.00, "#050008");

          skyCtx.fillStyle = grad;
          skyCtx.fillRect(0, 0, w, h);

          // nebulae
          if (Q.nebulaCount > 0) {
            skyCtx.save();
            skyCtx.globalCompositeOperation = "screen";
            for (const n of nebulaSeeds) {
              const cx = n.x * w;
              const cy = n.y * h;
              const rad = n.r * w;
              const ng = skyCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
              ng.addColorStop(0, parseRGBAlpha(theme.nebulaColor1, 0.07));
              ng.addColorStop(0.5, parseRGBAlpha(theme.nebulaColor2, 0.035));
              ng.addColorStop(1, "rgba(0,0,0,0)");
              skyCtx.fillStyle = ng;
              skyCtx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
            }
            skyCtx.restore();
          }

          // horizon glow
          const hot = skyCtx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.85);
          hot.addColorStop(0, parseRGBAlpha(theme.skyBot, 0.40));
          hot.addColorStop(0.18, parseRGBAlpha(theme.skyMid5, 0.28));
          hot.addColorStop(0.55, parseRGBAlpha(theme.skyMid2, 0.06));
          hot.addColorStop(1, "rgba(0,0,0,0)");
          skyCtx.fillStyle = hot;
          skyCtx.fillRect(0, 0, w, h);

          // stars
          skyCtx.save();
          skyCtx.globalCompositeOperation = "screen";
          skyCtx.fillStyle = "#dde6ff";
          for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            skyCtx.globalAlpha = s.a * 0.6;
            skyCtx.beginPath();
            skyCtx.arc(s.x * w, s.y * h, s.r, 0, TAU);
            skyCtx.fill();
          }
          skyCtx.restore();

          skyCached = true;
        }

        ctx.drawImage(skyCanvas, 0, 0);
        return;
      }

      const breathe = 1 + loopSin(t, 0.04) * 0.045;
      const sat = 1 + loopSin(t, 0.08) * 0.03;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      
      const parseRGB = (rgbStr: string) => {
        const parts = rgbStr.match(/\d+/g);
        return parts ? parts.map(Number) : [0, 0, 0];
      };

      const cTop = parseRGB(theme.skyTop);
      const cMid1 = parseRGB(theme.skyMid1);
      const cMid2 = parseRGB(theme.skyMid2);
      const cMid3 = parseRGB(theme.skyMid3);
      const cMid4 = parseRGB(theme.skyMid4);
      const cMid5 = parseRGB(theme.skyMid5);
      const cBot = parseRGB(theme.skyBot);

      const toBreatheRGB = (c: number[]) => {
        const r = clamp((c[0] * breathe) | 0, 0, 255);
        const g = clamp((c[1] * breathe) | 0, 0, 255);
        const b = clamp((c[2] * breathe * sat) | 0, 0, 255);
        return `rgb(${r}, ${g}, ${b})`;
      };

      grad.addColorStop(0.00, toBreatheRGB(cTop));
      grad.addColorStop(0.18, toBreatheRGB(cMid1));
      grad.addColorStop(0.32, toBreatheRGB(cMid2));
      grad.addColorStop(0.45, toBreatheRGB(cMid3));
      grad.addColorStop(0.52, toBreatheRGB(cMid4));
      grad.addColorStop(0.54, toBreatheRGB(cMid5));
      grad.addColorStop(0.545, toBreatheRGB(cBot));
      grad.addColorStop(0.56, "#0a0014");
      grad.addColorStop(1.00, "#050008");
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // nebula clouds
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const n of nebulaSeeds) {
        const drift = loopSin(t, n.p * 0.5) * 0.02;
        const cx = (n.x + drift) * w;
        const cy = n.y * h;
        const rad = n.r * w;
        const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const a = 0.07 + loopSin(t, n.p) * 0.02;

        ng.addColorStop(0, parseRGBAlpha(theme.nebulaColor1, a));
        ng.addColorStop(0.5, parseRGBAlpha(theme.nebulaColor2, a * 0.5));
        ng.addColorStop(1, "rgba(0,0,0,0)");
        
        ctx.fillStyle = ng;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }
      ctx.restore();

      // hot horizon glow
      const hot = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.85);

      hot.addColorStop(0, parseRGBAlpha(theme.skyBot, 0.40));
      hot.addColorStop(0.18, parseRGBAlpha(theme.skyMid5, 0.28));
      hot.addColorStop(0.55, parseRGBAlpha(theme.skyMid2, 0.06));
      hot.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hot;
      ctx.fillRect(0, 0, w, h);

      // stars
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = 0.45 + 0.55 * Math.sin(TAU * (p * s.speed + s.p));
        ctx.globalAlpha = s.a * tw * 0.6;
        ctx.fillStyle = "#dde6ff";
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, TAU);
        ctx.fill();
        if (currentQuality === "high" && s.r > 1.2) {
          ctx.globalAlpha = s.a * tw * 0.25;
          ctx.fillRect(s.x * w - s.r * 3, s.y * h - 0.3, s.r * 6, 0.6);
          ctx.fillRect(s.x * w - 0.3, s.y * h - s.r * 3, 0.6, s.r * 6);
        }
      }
      ctx.restore();

      // grain (high quality only)
      if (currentQuality === "high" && grain) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.14 + loopSin(t, 0.21) * 0.03;
        const gs = grain.width;
        ctx.drawImage(grain, -((p * 130) % gs), -((p * 90) % gs), w + gs * 2, h + gs * 2);
        ctx.restore();
      }
    }

    function drawSun(t: number, theme: typeof themes.small) {
      const pulse = 1 + loopSin(t, 0.12) * 0.085;
      const r = clamp(w * 0.175, 120, h * 0.35);
      const x = w * 0.5;
      const y = horizon;

      // outer bloom (high quality only - expensive full-screen radial fillrate)
      if (currentQuality === "high") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const aura = ctx.createRadialGradient(x, y, r * 0.12, x, y, r * 2.2 * pulse);

        aura.addColorStop(0, "rgba(255,245,120,0.68)");
        aura.addColorStop(0.12, "rgba(255,210,80,0.48)");
        aura.addColorStop(0.30, parseRGBAlpha(theme.skyBot, 0.30));
        aura.addColorStop(0.55, parseRGBAlpha(theme.skyMid5, 0.20));
        aura.addColorStop(1, "rgba(255,70,180,0)");
        ctx.fillStyle = aura;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // Draw sun disc to offscreen canvas to cut stripes cleanly
      if (sunCanvas && sunCtx) {
        const size = (r * 2) | 0;
        if (sunCanvas.width !== size || sunCanvas.height !== size) {
          sunCanvas.width = size;
          sunCanvas.height = size;
        }
        sunCtx.clearRect(0, 0, size, size);

        // sun disc
        sunCtx.save();
        sunCtx.beginPath();
        sunCtx.arc(r, r, r, 0, TAU);
        sunCtx.clip();

        const fill = sunCtx.createLinearGradient(0, 0, 0, size);
        fill.addColorStop(0.00, "#fffce0");
        fill.addColorStop(0.20, theme.sunColor1);
        fill.addColorStop(0.50, theme.sunColor2);
        fill.addColorStop(1.00, theme.sunColor3);
        sunCtx.fillStyle = fill;
        sunCtx.fillRect(0, 0, size, size);

        // STRIPES (relative to offscreen canvas coordinates)
        const stripeDrift = loopSin(t, 0.18) * 3;
        const sunMid = r; // center of sun in offscreen Y coords is r

        const cuts = 5;
        let cy = sunMid + r * 0.08 + stripeDrift;
        for (let i = 0; i < cuts; i++) {
          const prog = i / (cuts - 1);
          const gapH = r * (0.04 + prog * 0.14);
          const stripeH = r * (0.14 - prog * 0.10);

          sunCtx.globalCompositeOperation = "destination-out";
          sunCtx.fillStyle = "rgba(0,0,0,1)";
          sunCtx.fillRect(0, cy, size, gapH);

          cy += gapH + stripeH;
        }

        // Inner glow
        sunCtx.globalCompositeOperation = "source-over";
        const core = sunCtx.createRadialGradient(r, r - r * 0.3, 0, r, r - r * 0.3, r * 0.5);
        core.addColorStop(0, "rgba(255,255,220,0.30)");
        core.addColorStop(1, "rgba(255,255,220,0)");
        sunCtx.fillStyle = core;
        sunCtx.fillRect(0, 0, size, size);

        sunCtx.restore();

        // Draw offscreen sun canvas on top of background sky
        ctx.drawImage(sunCanvas, x - r, y - r * 1.5);
      } else {
        // Fallback if offscreen canvas fails
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y - r * 0.5, r, 0, TAU);
        ctx.clip();

        const fill = ctx.createLinearGradient(0, y - r * 1.5, 0, y + r * 0.5);
        fill.addColorStop(0.00, "#fffce0");
        fill.addColorStop(0.20, theme.sunColor1);
        fill.addColorStop(0.50, theme.sunColor2);
        fill.addColorStop(1.00, theme.sunColor3);
        ctx.fillStyle = fill;
        ctx.fillRect(x - r, y - r * 1.5, r * 2, r * 2);

        // STRIPES
        const stripeDrift = loopSin(t, 0.18) * 3;
        const sunMid = y - r * 0.5;

        const cuts = 5;
        let cy = sunMid + r * 0.08 + stripeDrift;
        for (let i = 0; i < cuts; i++) {
          const prog = i / (cuts - 1);
          const gapH = r * (0.04 + prog * 0.14);
          const stripeH = r * (0.14 - prog * 0.10);

          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(x - r * 1.2, cy, r * 2.4, gapH);

          cy += gapH + stripeH;
        }

        ctx.globalCompositeOperation = "source-over";
        const core = ctx.createRadialGradient(x, y - r * 0.8, 0, x, y - r * 0.8, r * 0.5);
        core.addColorStop(0, "rgba(255,255,220,0.30)");
        core.addColorStop(1, "rgba(255,255,220,0)");
        ctx.fillStyle = core;
        ctx.fillRect(x - r, y - r * 1.5, r * 2, r * 2);

        ctx.restore();
      }

      // horizon blend (drawn full-screen width w instead of r * 2 to avoid harsh rectangle boundaries)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const hb = ctx.createLinearGradient(0, horizon - r * 0.05, 0, horizon + r * 0.5);
      hb.addColorStop(0, "rgba(10,0,20,0)");
      hb.addColorStop(0.5, "rgba(10,0,20,0.42)");
      hb.addColorStop(1, "rgba(10,0,20,0.85)");
      ctx.fillStyle = hb;
      ctx.fillRect(0, horizon - r * 0.05, w, r * 0.6);
      ctx.restore();

      // lens flare line
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const flare = ctx.createLinearGradient(0, y, w, y);
      flare.addColorStop(0, "rgba(255,200,80,0)");
      flare.addColorStop(0.5, `rgba(255,220,100,${0.10 * pulse})`);
      flare.addColorStop(1, "rgba(255,200,80,0)");
      ctx.fillStyle = flare;
      ctx.fillRect(0, y - 1, w, 2);
      ctx.restore();
    }

    function drawSunReflection(t: number, theme: typeof themes.small) {
      const pulse = 1 + loopSin(t, 0.12) * 0.085;
      const r = clamp(w * 0.175, 120, h * 0.35);
      const x = w * 0.5;
      const y = horizon;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const refGrad = ctx.createLinearGradient(0, y, 0, h);

      refGrad.addColorStop(0, parseRGBAlpha(theme.skyBot, 0.24 * pulse));
      refGrad.addColorStop(0.3, parseRGBAlpha(theme.sunColor2, 0.14 * pulse));
      refGrad.addColorStop(0.7, parseRGBAlpha(theme.sunColor3, 0.06 * pulse));
      refGrad.addColorStop(1, "rgba(255,80,160,0)");
      ctx.fillStyle = refGrad;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.18, y);
      ctx.lineTo(x + r * 0.18, y);
      ctx.lineTo(x + r * 0.55, h);
      ctx.lineTo(x - r * 0.55, h);
      ctx.closePath();
      ctx.fill();

      // shimmer bands
      const shimmer = loopSin(t, 0.25) * 0.5 + 0.5;
      const bands = QUALITY === "low" ? 5 : 8;
      for (let i = 0; i < bands; i++) {
        const z = i / bands + (t * 0.06) % (1 / bands);
        const ry = roadY(z);
        const rw = lerp(r * 0.2, r * 0.5, z);
        const a = (1 - z) * 0.10 * shimmer * pulse;
        ctx.fillStyle = `rgba(255,220,120,${a})`;
        ctx.fillRect(x - rw, ry - 1.5, rw * 2, 3);
      }
      ctx.restore();
    }

    function drawPyramid(cxn: number, widthN: number, heightN: number, depth: number, t: number, phaseVal: number) {
      const vx = w * 0.5 + cxn * w * 0.44;
      const bw = widthN * w;
      const ph = heightN * h;
      const vib = loopSin(t, phaseVal) * 2.4;
      const y = horizon + h * 0.025 + vib;
      const left = vx - bw * 0.5;
      const right = vx + bw * 0.5;
      const apexY = y - ph;

      const fade = 0.30 + depth * 0.70;
      const atmR = lerp(160, 0, depth);
      const atmG = lerp(130, 255, depth);
      const atmB = lerp(200, 255, depth);
      const edgeColor = `rgba(${atmR | 0},${atmG | 0},${atmB | 0},${fade})`;
      const innerColor = `rgba(${atmR | 0},${atmG | 0},${atmB | 0},${fade * 0.40})`;

      ctx.save();

      // translucent body
      ctx.globalCompositeOperation = "source-over";
      const bodyGrad = ctx.createLinearGradient(vx, apexY, vx, y);
      bodyGrad.addColorStop(0, `rgba(15,5,35,${0.50 * fade})`);
      bodyGrad.addColorStop(1, `rgba(5,2,15,${0.25 * fade})`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(vx, apexY);
      ctx.lineTo(right, y);
      ctx.closePath();
      ctx.fill();

      // wireframe glow
      ctx.globalCompositeOperation = "lighter";

      // inner grid
      glowStroke(innerColor, 1.0, 8 * fade, 1);
      ctx.beginPath();
      const lines = Q.pyramidLines;
      for (let i = 1; i < lines; i++) {
        const k = i / lines;
        const yy = lerp(apexY, y, k);
        const lx = lerp(vx, left, k);
        const rx = lerp(vx, right, k);
        ctx.moveTo(lx, yy);
        ctx.lineTo(rx, yy);
      }
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const bx = lerp(left, right, (i + 3) / 6);
        ctx.moveTo(bx, y);
        ctx.lineTo(vx, apexY);
      }
      ctx.stroke();

      // outer outline
      glowStroke(edgeColor, 4.0, 20 * fade, 1);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(vx, apexY);
      ctx.lineTo(right, y);
      ctx.stroke();
      glowStroke(`rgba(180,252,255,${fade})`, 1.4, 12 * fade, 1);
      ctx.stroke();

      // ridge
      glowStroke(edgeColor, 1.6, 10 * fade, 1);
      ctx.beginPath();
      ctx.moveTo(vx, y);
      ctx.lineTo(vx, apexY);
      ctx.stroke();

      // apex
      ctx.shadowColor = edgeColor;
      ctx.shadowBlur = 16 * fade * Q.glowScale;
      ctx.fillStyle = `rgba(200,252,255,${fade})`;
      ctx.beginPath();
      ctx.arc(vx, apexY, 2.0 + depth * 1.2, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    function drawPyramids(t: number) {
      drawPyramid(-0.82, 0.08, 0.058, 0.10, t, 0.03);
      drawPyramid(-0.58, 0.10, 0.075, 0.18, t, 0.10);
      drawPyramid( 0.58, 0.10, 0.075, 0.18, t, 0.67);
      drawPyramid( 0.82, 0.08, 0.058, 0.10, t, 0.74);
      drawPyramid(-0.42, 0.15, 0.108, 0.38, t, 0.19);
      drawPyramid(-0.24, 0.12, 0.090, 0.30, t, 0.27);
      drawPyramid( 0.24, 0.12, 0.090, 0.30, t, 0.53);
      drawPyramid( 0.42, 0.15, 0.108, 0.38, t, 0.61);
      drawPyramid(-0.14, 0.19, 0.138, 0.58, t, 0.34);
      drawPyramid( 0.14, 0.19, 0.138, 0.58, t, 0.46);
    }

    function drawTerrain(t: number, p: number, theme: typeof themes.small) {
      const rows = Q.terrainRows;
      const cols = Q.terrainCols;
      const scroll = (p * 0.92) % (1 / rows);
      const neon = 1 + loopSin(t, 0.26) * 0.15;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const splitColor = (rgbaStr: string) => {
        const parts = rgbaStr.match(/[\d.]+/g);
        return parts ? parts.map(Number) : [180, 50, 255, 0.55];
      };

      const m = splitColor(theme.gridMagenta);
      const c = splitColor(theme.gridCyan);

      const gradMagenta = ctx.createLinearGradient(0, horizon, 0, h);
      gradMagenta.addColorStop(0, `rgba(${m[0]}, ${m[1]}, ${m[2]}, 0.0)`);
      gradMagenta.addColorStop(0.25, `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${m[3] * 0.45})`);
      gradMagenta.addColorStop(1.0, `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${m[3]})`);

      const gradCyan = ctx.createLinearGradient(0, horizon, 0, h);
      gradCyan.addColorStop(0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.0)`);
      gradCyan.addColorStop(0.25, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] * 0.45})`);
      gradCyan.addColorStop(1.0, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`);

      ctx.lineWidth = 1.1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (Q.glowScale > 0) {
        ctx.shadowColor = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.4)`;
        ctx.shadowBlur = 8 * neon * Q.glowScale;
      } else {
        ctx.shadowBlur = 0;
      }

      // Precompute terrain point grids ONCE per frame — reused across all 4
      // stroke batches (horizontal/vertical × cyan/magenta). Halves the
      // projectTerrain trig calls vs. recomputing per batch.
      type Pt = { x: number; y: number };
      const gridScroll: Pt[][][] = []; // scrolled z (horizontal lines)
      const gridFixed: Pt[][][] = [];  // fixed z (vertical lines)
      for (let si = 0; si < 2; si++) {
        const side = si === 0 ? -1 : 1;
        const rs: Pt[][] = [];
        const rf: Pt[][] = [];
        for (let r = 0; r <= rows; r++) {
          const zScroll = clamp(r / rows + scroll, 0, 1);
          const zFixed = r / rows;
          const cs: Pt[] = [];
          const cf: Pt[] = [];
          for (let c = 0; c <= cols; c++) {
            const xn = side * lerp(0.16, 1.38, c / cols);
            cs.push(projectTerrain(xn, zScroll, t));
            cf.push(projectTerrain(xn, zFixed, t));
          }
          rs.push(cs);
          rf.push(cf);
        }
        gridScroll.push(rs);
        gridFixed.push(rf);
      }

      for (let si = 0; si < 2; si++) {
        // BATCH 1: Horizontal magenta rows
        ctx.strokeStyle = gradMagenta;
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          if (r % 4 === 0) continue;
          const pt0 = gridScroll[si][r][0];
          ctx.moveTo(pt0.x, pt0.y);
          for (let colIndex = 1; colIndex <= cols; colIndex++) {
            const pt = gridScroll[si][r][colIndex];
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();

        // BATCH 2: Horizontal cyan rows
        ctx.strokeStyle = gradCyan;
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          if (r % 4 !== 0) continue;
          const pt0 = gridScroll[si][r][0];
          ctx.moveTo(pt0.x, pt0.y);
          for (let colIndex = 1; colIndex <= cols; colIndex++) {
            const pt = gridScroll[si][r][colIndex];
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();

        // BATCH 3: Vertical magenta columns
        ctx.strokeStyle = gradMagenta;
        ctx.beginPath();
        for (let colIndex = 0; colIndex <= cols; colIndex++) {
          if (colIndex % 5 === 0) continue;
          const pt0 = gridFixed[si][0][colIndex];
          ctx.moveTo(pt0.x, pt0.y);
          for (let r = 1; r <= rows; r++) {
            const pt = gridFixed[si][r][colIndex];
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();

        // BATCH 4: Vertical cyan columns
        ctx.strokeStyle = gradCyan;
        ctx.beginPath();
        for (let colIndex = 0; colIndex <= cols; colIndex++) {
          if (colIndex % 5 !== 0) continue;
          const pt0 = gridFixed[si][0][colIndex];
          ctx.moveTo(pt0.x, pt0.y);
          for (let r = 1; r <= rows; r++) {
            const pt = gridFixed[si][r][colIndex];
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();
      }

      // Horizon line
      glowStroke(`rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.4)`, 1.5, 12 * neon, 1);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(w, horizon);
      ctx.stroke();

      ctx.restore();
    }

    function drawRoad(t: number, p: number, theme: typeof themes.small) {
      const roadGrad = ctx.createLinearGradient(0, horizon, 0, h);
      roadGrad.addColorStop(0, theme.roadColor1);
      roadGrad.addColorStop(0.48, theme.roadColor2);
      roadGrad.addColorStop(1, theme.roadColor3);
      ctx.beginPath();
      ctx.moveTo(roadX(-1, 0), roadY(0));
      ctx.lineTo(roadX(1, 0), roadY(0));
      ctx.lineTo(roadX(1, 1), roadY(1));
      ctx.lineTo(roadX(-1, 1), roadY(1));
      ctx.closePath();
      ctx.fillStyle = roadGrad;
      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.fill();
      ctx.restore();

      drawSunReflection(t, theme);

      const neon = 1 + loopSin(t, 0.32) * 0.17;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (const side of [-1, 1]) {
        glowStroke("rgba(0,255,255,0.35)", 7, 28 * neon, 1);
        ctx.beginPath();
        for (let i = 0; i <= Q.roadSegments; i++) {
          const z = i / Q.roadSegments;
          const x = roadX(side, z);
          const y = roadY(z);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        glowStroke("rgba(120,252,255,0.98)", 2.4, 18 * neon, 1);
        ctx.stroke();
      }

      // dashes
      const stripes = QUALITY === "low" ? 12 : 20;
      const move = (p * 1.42) % (1 / stripes);
      for (let i = 0; i < stripes; i++) {
        const z0 = i / stripes + move;
        const z1 = z0 + 0.018 + z0 * 0.030;
        if (z0 > 1 || z1 < 0.02) continue;

        const y0 = roadY(z0);
        const y1 = roadY(Math.min(z1, 1));
        const w0 = lerp(1.2, w * 0.018, Math.pow(z0, 1.6));
        const w1 = lerp(1.6, w * 0.022, Math.pow(z1, 1.6));
        const alpha = clamp((z0 - 0.03) / 0.16, 0, 1) * (1 - clamp((z0 - 0.95) / 0.05, 0, 1));

        ctx.fillStyle = `rgba(0,255,255,${0.92 * alpha})`;
        if (Q.glowScale > 0) {
          ctx.shadowColor = "#00ffff";
          ctx.shadowBlur = 18 * neon * Q.glowScale;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - w0, y0);
        ctx.lineTo(w * 0.5 + w0, y0);
        ctx.lineTo(w * 0.5 + w1, y1);
        ctx.lineTo(w * 0.5 - w1, y1);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    function drawPalm(px: number, py: number, scale: number, t: number, phaseVal: number, side: number, trunkCurve: number) {
      const sway = loopSin(t, phaseVal) * 0.025 * side;
      const isLow = currentQuality === "low" || currentQuality === "ultra";

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(scale, scale);
      ctx.rotate(sway);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";

      // trunk
      const curve = trunkCurve;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.bezierCurveTo(
        -3 + curve * 12, -35,
        -6 + curve * 22, -80,
        0 + curve * 16, -125
      );
      ctx.bezierCurveTo(
        8 + curve * 16, -80,
        5 + curve * 22, -35,
        5, 0
      );
      ctx.closePath();
      ctx.fill();

      // crown
      ctx.translate(0 + curve * 16, -125);
      ctx.rotate(sway * 1.5);
      
      const leafCount = isLow ? 6 : 13;
      for (let i = 0; i < leafCount; i++) {
        const ang = -1.3 + i * (2.6 / (leafCount - 1)) + Math.sin(i * 1.6 + phaseVal * 10) * 0.04;
        const len = 52 + Math.sin(i * 1.8 + phaseVal * TAU) * 16 + (i % 2) * 10;
        const droop = 8 + Math.sin(i) * 6;
        
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.4, -15, len, droop + 3);
        ctx.quadraticCurveTo(len * 0.4, droop - 6, 0, 0);
        ctx.fill();

        if (!isLow) {
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(len * 0.40, -14, len, droop + 2);
          ctx.stroke();
          
          ctx.lineWidth = 0.5;
          for (let j = 1; j < 5; j++) {
            const t2 = j / 5;
            const sx = len * t2 * 0.4;
            const sy = -14 * (1 - t2) + droop * t2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + 6, sy + 8 + t2 * 4);
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - 6, sy + 8 + t2 * 4);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.arc(0, 2, 3.5, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    function drawPalms(t: number) {
      const palms = [
        { x: 0.26, z: 0.50, s: 0.38, p: 0.83, side: -1, curve: -0.5 },
        { x: 0.74, z: 0.50, s: 0.36, p: 0.92, side: 1, curve: 0.5 },
        { x: 0.18, z: 0.62, s: 0.52, p: 0.61, side: -1, curve: -0.6 },
        { x: 0.82, z: 0.62, s: 0.50, p: 0.76, side: 1, curve: 0.6 },
        { x: 0.22, z: 0.78, s: 0.82, p: 0.37, side: -1, curve: -0.7 },
        { x: 0.78, z: 0.78, s: 0.78, p: 0.50, side: 1, curve: 0.7 },
        { x: 0.10, z: 1.02, s: 1.85, p: 0.07, side: -1, curve: 0.9 },
        { x: 0.90, z: 1.02, s: 1.90, p: 0.22, side: 1, curve: -0.9 },
      ];

      const count = Math.min(palms.length, Q.palmCount + 2);
      for (let i = 0; i < count; i++) {
        const palm = palms[i];
        drawPalm(
          palm.x * w,
          roadY(palm.z) + h * 0.04,
          (palm.s * Math.min(w, h)) / 760,
          t,
          palm.p,
          palm.side,
          palm.curve
        );
      }
    }

    function drawPost(t: number, p: number) {
      if (currentQuality !== "ultra") {
        const haze = ctx.createLinearGradient(0, horizon - h * 0.04, 0, h * 0.85);
        haze.addColorStop(0, "rgba(255,130,100,0.08)");
        haze.addColorStop(0.12, "rgba(255,80,180,0.12)");
        haze.addColorStop(0.40, "rgba(70,15,115,0.10)");
        haze.addColorStop(1, "rgba(0,0,0,0.20)");
        ctx.fillStyle = haze;
        ctx.fillRect(0, horizon - h * 0.04, w, h - horizon + h * 0.04);
      }

      if (currentQuality === "high") {
        const vig = ctx.createRadialGradient(w * 0.5, h * 0.50, w * 0.15, w * 0.5, h * 0.52, Math.max(w, h) * 0.75);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(0.6, "rgba(0,0,0,0.10)");
        vig.addColorStop(1, "rgba(0,0,0,0.45)");
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);
      }
    }

    let lastFrame = 0;
    let animationId = 0;

    const render = (now: number) => {
      animationId = requestAnimationFrame(render);

      const frameMinTime = currentQuality === "ultra" ? 45 : (currentQuality === "low" ? 33 : 16);
      if (now - lastFrame < frameMinTime) {
        return;
      }
      const delta = now - lastFrame;
      lastFrame = now;

      // Track frame times to detect CPU rendering lag
      frameTimes.push(delta);
      if (frameTimes.length > maxFrameHistory) {
        frameTimes.shift();
      }

      // Check performance every 2.5 seconds (roughly 75-150 frames)
      if (now - lastPerformanceCheck > 2500) {
        lastPerformanceCheck = now;
        const avgDelta = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        // If average frame rendering time is > 40ms (less than 25 FPS)
        if (avgDelta > 40) {
          if (currentQuality === "high") {
            currentQuality = "low";
            Q = { ...presets.low };
            resize();
            console.warn("MiniCard: Performance lag detected. Downgrading to low-power background rendering.");
          } else if (currentQuality === "low") {
            currentQuality = "ultra";
            Q = { ...presets.ultra };
            resize();
            console.warn("MiniCard: Severe lag detected. Downgrading to ultra-low background rendering.");
          }
        }
      }

      frameCount++;
      if (frameCount % Q.skipFrames !== 0) {
        return;
      }

      const t = ((now - start) / 1000) % LOOP;
      const p = t / LOOP;
      const theme = themes[blindKind] || themes.small;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      drawSky(t, p, theme);
      drawSun(t, theme);
      drawPyramids(t);
      drawTerrain(t, p, theme);
      drawRoad(t, p, theme);
      drawPalms(t);
      drawPost(t, p);
    };

    // Single static frame at t=0/p=0 — used when the user prefers reduced
    // motion. Draws the full scene once with the correct blind-theme palette
    // (no animation), so the background never goes blank. At t=0 the
    // breathing/pulse/shimmer coefficients resolve to their neutral values,
    // producing a valid, representative frame.
    const drawStaticFrame = () => {
      const theme = themes[blindKind] || themes.small;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(0, 0, theme);
      drawSun(0, theme);
      drawPyramids(0);
      drawTerrain(0, 0, theme);
      drawRoad(0, 0, theme);
      drawPalms(0);
      drawPost(0, 0);
    };

    // Respect prefers-reduced-motion: render one static frame and never start
    // the rAF loop. Resize/orientation changes still redraw a single frame.
    // Guarded for SSR (useEffect never runs during SSR, but be defensive).
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    resize();
    if (reduceMotion) {
      drawStaticFrame();
    } else {
      animationId = requestAnimationFrame(render);
    }

    const handleResize = () => {
      resize();
      if (reduceMotion) drawStaticFrame();
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", () => setTimeout(handleResize, 200), { passive: true });

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [blindKind]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ zIndex: -10 }}
      />
      <div
        className="synthwave-overlay"
        data-blind={blindKind}
        data-phase={phase}
        aria-hidden="true"
        style={{ zIndex: -9 }}
      />
    </>
  );
}
