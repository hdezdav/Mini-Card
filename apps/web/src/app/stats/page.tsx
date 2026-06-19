"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import {
  LEADERBOARD_CONTRACT_ADDRESS,
  MINICARD_LEADERBOARD_ABI,
} from "@/lib/web3";

/* ═══════════════════════════════════════════
   i18n — English (default) + Spanish
   ═══════════════════════════════════════════ */
type Lang = "en" | "es";

const t = {
  back:           { en: "← Back",              es: "← Volver" },
  title:          { en: "Statistics",           es: "Estadísticas" },
  live:           { en: "Live · reload to update", es: "En vivo · recarga para actualizar" },
  noData:         { en: "No data yet",          es: "No hay datos aún" },
  // Sections
  today:          { en: "Today",                es: "Hoy" },
  players:        { en: "Players",              es: "Jugadores" },
  retention:      { en: "Retention",            es: "Retención" },
  games:          { en: "Games",                es: "Jugadas" },
  scoreDistrib:   { en: "Score Distribution",   es: "Distribución de puntajes" },
  roundsReached:  { en: "Rounds Reached",       es: "Rondas alcanzadas" },
  onchain:        { en: "On-chain",             es: "On-chain" },
  contracts:      { en: "Contracts",            es: "Contratos" },
  // Cards
  gamesToday:     { en: "Games today",          es: "Jugadas hoy" },
  total:          { en: "Total",                es: "Total" },
  last7d:         { en: "last 7 days",          es: "últimos 7 días" },
  last30d:        { en: "last 30 days",         es: "últimos 30 días" },
  gamesPerPlayer: { en: "Games / player",       es: "Jugadas / jugador" },
  average:        { en: "average",              es: "promedio" },
  bestStreak:     { en: "Best streak",          es: "Mejor racha" },
  player:         { en: "Player",               es: "Jugador" },
  gamesCol:       { en: "Games",                es: "Jugadas" },
  // Retention
  cohort:         { en: "Cohort",               es: "Cohorte" },
  returned:       { en: "Returned",             es: "Volvieron" },
  rate:           { en: "Rate",                 es: "Tasa" },
  day1to2:        { en: "Day 1 → Day 2",        es: "Día 1 → Día 2" },
  day1to7:        { en: "Day 1 → Day 7",        es: "Día 1 → Día 7" },
  day1to30:       { en: "Day 1 → Day 30",       es: "Día 1 → Día 30" },
  // Games
  totalGames:     { en: "Total",                es: "Totales" },
  thisWeek:       { en: "This week",            es: "Esta semana" },
  thisMonth:      { en: "This month",           es: "Este mes" },
  avgScore:       { en: "Avg. score",           es: "Puntaje prom." },
  avgRound:       { en: "Avg. round",           es: "Ronda prom." },
  chart14d:       { en: "Games — last 14 days", es: "Jugadas — últimos 14 días" },
  // Score distrib
  range:          { en: "Range",                es: "Rango" },
  // Rounds
  highestRound:   { en: "Highest round",        es: "Ronda más alta" },
  bestScore:      { en: "Best score",           es: "Mejor puntaje" },
  roundLabel:     { en: "round",                es: "ronda" },
  // On-chain
  totalTx:        { en: "Total tx",             es: "Tx totales" },
  addresses:      { en: "addresses",            es: "direcciones" },
  gamesOnchain:   { en: "Games on-chain",       es: "Jugadas on-chain" },
  eachGame:       { en: "each game hits the contract", es: "cada jugada toca el contrato" },
  daysOnchain:    { en: "Days on-chain",        es: "Días on-chain" },
  since:          { en: "since",                es: "desde" },
  playersOnchain: { en: "Players on-chain",     es: "Jugadores on-chain" },
  operator:       { en: "Operator",             es: "Operador" },
} as const;

function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const nav = navigator.language || (navigator as any).userLanguage || "en";
    setLang(nav.toLowerCase().startsWith("es") ? "es" : "en");
  }, []);
  return lang;
}

/* ── Unlock scroll ── */
function useUnlockScroll() {
  useEffect(() => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);
}

/* ── Types ── */
interface ScoreEntry { player: string; score: number; round: number; timestamp: number; }
interface TxInfo { total: number; uniqueAddresses: number; firstTxDate: string | null; daysOnChain: number; }

/* ── Helpers ── */
const pc = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
function daysAgo(ts: number, n: number) { return ts * 1000 > Date.now() - n * 86400000; }
function fmt(n: number) { return n.toLocaleString("en-US"); }
function fmtPct(n: number) { return `${Math.round(n * 100)}%`; }

/* ═══════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════ */
export default function StatsPage() {
  useUnlockScroll();
  const l = useLang();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [txInfo, setTxInfo] = useState<TxInfo>({ total: 0, uniqueAddresses: 0, firstTxDate: null, daysOnChain: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = (await pc.readContract({
          address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
          abi: MINICARD_LEADERBOARD_ABI,
          functionName: "getAllScores",
        })) as any[];
        setScores(raw.map((e: any) => ({
          player: e.player, score: Number(e.score), round: Number(e.round), timestamp: Number(e.timestamp),
        })));
        try {
          const res = await fetch(
            `https://api.celoscan.io/api?module=account&action=txlist&address=${LEADERBOARD_CONTRACT_ADDRESS}&startblock=0&endblock=99999999&sort=asc`
          );
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            const txs = json.result;
            const addrs = new Set(txs.map((x: any) => x.from?.toLowerCase()));
            const firstTs = txs.length > 0 ? Number(txs[0].timeStamp) : 0;
            setTxInfo({
              total: txs.length,
              uniqueAddresses: addrs.size,
              firstTxDate: firstTs ? new Date(firstTs * 1000).toLocaleDateString() : null,
              daysOnChain: firstTs ? Math.floor((Date.now() / 1000 - firstTs) / 86400) : 0,
            });
          }
        } catch {}
      } catch (err) { console.error("Stats fetch error:", err); }
      finally { setLoading(false); }
    })();
  }, []);

  const stats = useMemo(() => {
    if (scores.length === 0) return null;
    const now = Date.now() / 1000;
    const uniquePlayers = new Set(scores.map((s) => s.player.toLowerCase()));
    const today = scores.filter((s) => daysAgo(s.timestamp, 1));
    const week = scores.filter((s) => daysAgo(s.timestamp, 7));
    const month = scores.filter((s) => daysAgo(s.timestamp, 30));
    const dauSet = new Set(today.map((s) => s.player.toLowerCase()));
    const wauSet = new Set(week.map((s) => s.player.toLowerCase()));
    const mauSet = new Set(month.map((s) => s.player.toLowerCase()));
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const avgScore = scores.reduce((a, s) => a + s.score, 0) / scores.length;
    const avgRound = scores.reduce((a, s) => a + s.round, 0) / scores.length;
    const maxRound = Math.max(...scores.map((s) => s.round));
    const brackets = [
      { label: "0–100", min: 0, max: 100 }, { label: "100–500", min: 100, max: 500 },
      { label: "500–1K", min: 500, max: 1000 }, { label: "1K–5K", min: 1000, max: 5000 },
      { label: "5K+", min: 5000, max: Infinity },
    ];
    const distrib = brackets.map((b) => ({ ...b, count: scores.filter((s) => s.score >= b.min && s.score < b.max).length }));
    const gpp: Record<string, number> = {};
    scores.forEach((s) => { const k = s.player.toLowerCase(); gpp[k] = (gpp[k] || 0) + 1; });
    const gpValues = Object.values(gpp);
    const avgGamesPerPlayer = gpValues.reduce((a, v) => a + v, 0) / gpValues.length;
    const topPlayers = Object.entries(gpp).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const playerFirstDay: Record<string, number> = {};
    scores.forEach((s) => { const k = s.player.toLowerCase(); const d = Math.floor(s.timestamp / 86400); if (!playerFirstDay[k] || d < playerFirstDay[k]) playerFirstDay[k] = d; });
    const playerDays: Record<string, Set<number>> = {};
    scores.forEach((s) => { const k = s.player.toLowerCase(); if (!playerDays[k]) playerDays[k] = new Set(); playerDays[k].add(Math.floor(s.timestamp / 86400)); });
    const retCalc = (offset: number) => {
      let eligible = 0, returned = 0;
      for (const [p, fd] of Object.entries(playerFirstDay)) { const td = fd + offset; if (td <= Math.floor(now / 86400)) { eligible++; if (playerDays[p]?.has(td)) returned++; } }
      return { eligible, returned, rate: eligible > 0 ? returned / eligible : 0 };
    };
    const roundBrackets = [
      { label: "Round 1–3", min: 1, max: 3 }, { label: "Round 4–6", min: 4, max: 6 },
      { label: "Round 7–10", min: 7, max: 10 }, { label: "Round 11+", min: 11, max: Infinity },
    ];
    const roundDistrib = roundBrackets.map((b) => ({ ...b, count: scores.filter((s) => s.round >= b.min && s.round <= b.max).length }));
    const dailyGames: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const ds = Math.floor(now / 86400) - i;
      const count = scores.filter((s) => Math.floor(s.timestamp / 86400) === ds).length;
      const d = new Date(ds * 86400 * 1000);
      dailyGames.push({ day: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, count });
    }
    return {
      totalPlayers: uniquePlayers.size, totalGames: scores.length,
      dau: dauSet.size, wau: wauSet.size, mau: mauSet.size,
      gamesToday: today.length, gamesWeek: week.length, gamesMonth: month.length,
      bestScore: best?.score ?? 0, bestRound: best?.round ?? 0,
      avgScore: Math.round(avgScore * 10) / 10, avgRound: Math.round(avgRound * 10) / 10, maxRound,
      distrib, roundDistrib, avgGamesPerPlayer: Math.round(avgGamesPerPlayer * 10) / 10,
      topPlayers, ret1: retCalc(1), ret7: retCalc(7), ret30: retCalc(30),
      dailyGames, maxDaily: Math.max(...dailyGames.map((d) => d.count), 1),
    };
  }, [scores]);

  return (
    <main className="min-h-[100dvh] bg-[#070b09] text-[#edf6ef] pb-12">
      <div className="max-w-[520px] mx-auto px-3 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/" className="text-[#ec4899] font-pixel text-sm hover:underline">{t.back[l]}</Link>
          <div className="flex-1" />
        </div>
        <h1 className="font-pixel-fat text-3xl text-[#facc15] txt-outline text-center mb-1">{t.title[l]}</h1>
        <p className="text-center font-pixel text-xs text-gray-400 mb-5">
          <span className="inline-block w-2 h-2 rounded-full bg-[#38d08f] animate-pulse mr-1 align-middle" />
          {t.live[l]}
        </p>

        {loading ? (
          <div className="flex justify-center py-20">
            <span className="inline-block w-8 h-8 border-4 border-[#ec4899]/30 border-t-[#ec4899] rounded-full animate-spin" />
          </div>
        ) : !stats ? (
          <div className="text-center font-pixel text-gray-400 py-20">{t.noData[l]}</div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Today */}
            <Section title={t.today[l]}>
              <div className="grid grid-cols-2 gap-2">
                <Card label="DAU" value={stats.dau} />
                <Card label={t.gamesToday[l]} value={stats.gamesToday} />
              </div>
            </Section>

            {/* Players */}
            <Section title={t.players[l]}>
              <div className="grid grid-cols-3 gap-2">
                <Card label={t.total[l]} value={fmt(stats.totalPlayers)} />
                <Card label="WAU" value={stats.wau} sub={t.last7d[l]} />
                <Card label="MAU" value={stats.mau} sub={t.last30d[l]} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.gamesPerPlayer[l]} value={stats.avgGamesPerPlayer} sub={t.average[l]} />
                <Card label={t.bestStreak[l]} value={stats.topPlayers[0]?.[1] ?? 0} sub={`${stats.topPlayers[0]?.[0]?.slice(0, 6)}...`} />
              </div>
              <div className="mt-2 bg-black/30 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-[1fr_60px] text-[10px] font-pixel text-gray-400 px-2 py-1 border-b border-white/5">
                  <span>{t.player[l]}</span><span className="text-right">{t.gamesCol[l]}</span>
                </div>
                {stats.topPlayers.map(([addr, count], i) => (
                  <div key={addr} className="grid grid-cols-[1fr_60px] text-[11px] font-pixel px-2 py-1 border-b border-white/[0.03]">
                    <span className="text-gray-300 truncate">{i + 1}. {addr.slice(0, 6)}...{addr.slice(-4)}</span>
                    <span className="text-right text-white">{count}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Retention */}
            <Section title={t.retention[l]}>
              <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-3 text-[10px] font-pixel text-gray-400 px-2 py-1 border-b border-white/5">
                  <span>{t.cohort[l]}</span><span className="text-center">{t.returned[l]}</span><span className="text-right">{t.rate[l]}</span>
                </div>
                {[
                  { label: t.day1to2[l], data: stats.ret1 },
                  { label: t.day1to7[l], data: stats.ret7 },
                  { label: t.day1to30[l], data: stats.ret30 },
                ].map((r) => (
                  <div key={r.label} className="grid grid-cols-3 text-[11px] font-pixel px-2 py-1 border-b border-white/[0.03]">
                    <span className="text-gray-300">{r.label}</span>
                    <span className="text-center text-gray-300">{r.data.returned} / {r.data.eligible}</span>
                    <span className="text-right text-white font-pixel-fat">{fmtPct(r.data.rate)}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Games */}
            <Section title={t.games[l]}>
              <div className="grid grid-cols-3 gap-2">
                <Card label={t.totalGames[l]} value={fmt(stats.totalGames)} accent />
                <Card label={t.thisWeek[l]} value={stats.gamesWeek} />
                <Card label={t.thisMonth[l]} value={stats.gamesMonth} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.avgScore[l]} value={stats.avgScore} />
                <Card label={t.avgRound[l]} value={stats.avgRound} />
              </div>
              <div className="mt-3 bg-black/30 rounded-lg border border-white/5 p-2">
                <div className="font-pixel text-[10px] text-gray-400 mb-2">{t.chart14d[l]}</div>
                <div className="flex items-end gap-[3px] h-[50px]">
                  {stats.dailyGames.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="w-full rounded-t bg-[#ec4899] min-h-[2px] transition-all" style={{ height: `${Math.max(4, (d.count / stats.maxDaily) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-[3px] mt-1">
                  {stats.dailyGames.filter((_, i) => i % 3 === 0 || i === stats.dailyGames.length - 1).map((d) => (
                    <span key={d.day} className="flex-1 text-[7px] font-pixel text-gray-500 text-center">{d.day}</span>
                  ))}
                </div>
              </div>
            </Section>

            {/* Score Distribution */}
            <Section title={t.scoreDistrib[l]}>
              <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-[1fr_50px_60px] text-[10px] font-pixel text-gray-400 px-2 py-1 border-b border-white/5">
                  <span>{t.range[l]}</span><span className="text-right">{t.gamesCol[l]}</span><span className="text-right">%</span>
                </div>
                {stats.distrib.map((b) => (
                  <div key={b.label} className="grid grid-cols-[1fr_50px_60px] text-[11px] font-pixel px-2 py-1 border-b border-white/[0.03]">
                    <span className="text-gray-300">{b.label}</span>
                    <span className="text-right text-white">{b.count}</span>
                    <span className="text-right text-gray-400">{stats.totalGames > 0 ? fmtPct(b.count / stats.totalGames) : "0%"}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Rounds Reached */}
            <Section title={t.roundsReached[l]}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Card label={t.highestRound[l]} value={stats.maxRound} accent />
                <Card label={t.bestScore[l]} value={fmt(stats.bestScore)} sub={`${t.roundLabel[l]} ${stats.bestRound}`} accent />
              </div>
              <div className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
                {stats.roundDistrib.map((b) => (
                  <div key={b.label} className="grid grid-cols-[1fr_50px_60px] text-[11px] font-pixel px-2 py-1 border-b border-white/[0.03]">
                    <span className="text-gray-300">{b.label}</span>
                    <span className="text-right text-white">{b.count}</span>
                    <span className="text-right text-gray-400">{stats.totalGames > 0 ? fmtPct(b.count / stats.totalGames) : "0%"}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* On-chain */}
            <Section title={t.onchain[l]}>
              <div className="grid grid-cols-2 gap-2">
                <Card label={t.totalTx[l]} value={fmt(txInfo.total)} sub={`${fmt(txInfo.uniqueAddresses)} ${t.addresses[l]}`} />
                <Card label={t.gamesOnchain[l]} value={fmt(stats.totalGames)} sub={t.eachGame[l]} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.daysOnchain[l]} value={txInfo.daysOnChain} sub={txInfo.firstTxDate ? `${t.since[l]} ${txInfo.firstTxDate}` : ""} />
                <Card label={t.playersOnchain[l]} value={fmt(stats.totalPlayers)} />
              </div>
            </Section>

            {/* Contracts */}
            <Section title={t.contracts[l]}>
              <ContractRow label="Leaderboard" address={LEADERBOARD_CONTRACT_ADDRESS} />
              <ContractRow label="USDT (Celo)" address="0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e" />
              <ContractRow label={t.operator[l]} address="0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE" />
            </Section>
          </div>
        )}

        <div className="text-center font-pixel text-[10px] text-gray-500 mt-8 mb-4">
          MiniCard · Celo Mainnet · Powered by MiniPay
        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-pixel-fat text-sm text-[#00b4d8] mb-2 flex items-center gap-2">
        <span className="flex-1 h-px bg-[#00b4d8]/20" />
        {title}
        <span className="flex-1 h-px bg-[#00b4d8]/20" />
      </h2>
      {children}
    </section>
  );
}

function Card({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-black/40 rounded-lg border border-white/5 px-2.5 py-2 flex flex-col items-center text-center">
      <span className="font-pixel text-[9px] text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`font-pixel-fat text-lg leading-none mt-0.5 ${accent ? "text-[#facc15]" : "text-white"}`}>{value}</span>
      {sub && <span className="font-pixel text-[8px] text-gray-500 mt-0.5">{sub}</span>}
    </div>
  );
}

function ContractRow({ label, address }: { label: string; address: string }) {
  return (
    <a
      href={`https://celoscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-black/30 rounded-lg border border-white/5 px-2.5 py-2 mb-1.5 hover:border-[#ec4899]/30 transition-colors group"
    >
      <span className="font-pixel text-[10px] text-gray-300 w-[80px] shrink-0">{label}</span>
      <span className="font-pixel text-[11px] text-[#ec4899] group-hover:text-[#f472b6] truncate">
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <span className="ml-auto text-gray-500 text-xs">↗</span>
    </a>
  );
}
