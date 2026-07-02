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
  title:          { en: "Statistics Dashboard", es: "Panel de Estadísticas" },
  live:           { en: "Live · reload to update", es: "En vivo · recarga para actualizar" },
  noData:         { en: "No data yet",          es: "No hay datos aún" },
  
  // Sections
  today:          { en: "Today",                es: "Hoy" },
  players:        { en: "Players",              es: "Jugadores" },
  retention:      { en: "Retention",            es: "Retención" },
  games:          { en: "Games",                es: "Jugadas" },
  scoreDistrib:   { en: "Score Distribution",   es: "Distribución de puntajes" },
  roundsReached:  { en: "Rounds Reached",       es: "Rondas alcanzadas" },
  onchain:        { en: "On-chain Metrics",     es: "Métricas On-chain" },
  contracts:      { en: "Protocol Contracts",   es: "Contratos del Protocolo" },
  economy:        { en: "Protocol Economy",     es: "Economía del Protocolo" },
  webAnalytics:   { en: "Web Analytics",        es: "Analítica Web" },

  // Cards & General labels
  gamesToday:     { en: "Games today",          es: "Jugadas hoy" },
  total:          { en: "Total",                es: "Total" },
  last7d:         { en: "last 7 days",          es: "últimos 7 días" },
  last30d:        { en: "last 30 days",         es: "últimos 30 días" },
  gamesPerPlayer: { en: "Games / player",       es: "Jugadas / jugador" },
  average:        { en: "average",              es: "promedio" },
  bestStreak:     { en: "Best streak",          es: "Mejor racha" },
  player:         { en: "Player",               es: "Jugador" },
  gamesCol:       { en: "Games",                es: "Jugadas" },
  highestRound:   { en: "Highest round",        es: "Ronda más alta" },
  bestScore:      { en: "Best score",           es: "Mejor puntaje" },
  roundLabel:     { en: "round",                es: "ronda" },
  operator:       { en: "Operator",             es: "Operador" },
  addressLabel:   { en: "addresses",            es: "direcciones" },
  sinceLabel:     { en: "since",                es: "desde" },

  // Economy Labels
  totalRevenue:   { en: "Total Revenue",        es: "Ingresos totales" },
  totalPaid:      { en: "Total Paid Out",       es: "Total pagado a ganadores" },
  highestPrize:   { en: "Highest Payout",       es: "Premio más alto" },
  treasuryUSDT:   { en: "Treasury (USDT)",      es: "Tesoro (USDT)" },
  treasuryCELO:   { en: "Treasury (CELO)",      es: "Tesoro (CELO)" },
  runway:         { en: "Estimated Runway",     es: "Runway estimado" },
  runwaySub:      { en: "based on operator network fees", es: "basado en comisiones de red del operador" },
  perGameLabel:   { en: "Per Game Runway",      es: "Runway por juego" },
  gameTitle:      { en: "Game",                 es: "Juego" },
  balanceTitle:   { en: "Balance",              es: "Saldo" },
  runwayTitle:    { en: "Runway",               es: "Runway" },
  infinite:       { en: "Infinite (Low burn)",  es: "Infinito (Bajo gasto)" },
  days:           { en: "days",                 es: "días" },

  // On-chain Labels
  totalTx:        { en: "Total transactions",   es: "Total transacciones" },
  activeAddresses:{ en: "Active Addresses",     es: "Direcciones activas" },
  playsOnchain:   { en: "Plays on-chain",       es: "Jugadas en contrato" },
  daysOnchain:    { en: "Days on-chain",        es: "Días on-chain" },
  usdtInflow:     { en: "USDT Inflow Vol",      es: "Vol. de entrada USDT" },
  usdtOutflow:    { en: "USDT Outflow Vol",     es: "Vol. de salida USDT" },
  gasOperator:    { en: "Operator Network Fees",    es: "Comisiones de red operador" },
  gasPlayers:     { en: "Players Network Fees",     es: "Comisiones de red jugadores" },
  failedTxRate:   { en: "Failed Tx Rate",       es: "Tasa tx fallidas" },
  txTableTitle:   { en: "Tx Types Distribution",es: "Transacciones por tipo" },
  txTypeCol:      { en: "Transaction Type",     es: "Tipo de Transacción" },
  txCountCol:     { en: "Count",                es: "Cant." },
  txPctCol:       { en: "Percentage",           es: "Porcentaje" },

  // Web Analytics Labels
  visitors7d:     { en: "Visitors (7 days)",    es: "Visitantes (7 días)" },
  visitors30d:    { en: "Visitors (30 days)",   es: "Visitantes (30 días)" },
  monthlySessions:{ en: "Sessions (30 days)",   es: "Sesiones (30 días)" },
  walletConnRate: { en: "Wallet Conn. Rate",    es: "Tasa conexión wallet" },
  deviceDistrib:  { en: "Devices",              es: "Dispositivos" },
  topCountries:   { en: "Top Countries",        es: "Top países" },
  topBrowsers:    { en: "Browsers",             es: "Navegadores" },
  topReferrers:   { en: "Traffic Sources",      es: "Fuentes de tráfico" },

  // Retention Labels
  cohort:         { en: "Cohort",               es: "Cohorte" },
  returned:       { en: "Returned",             es: "Volvieron" },
  rate:           { en: "Rate",                 es: "Tasa" },
  day1to2:        { en: "Day 1 → Day 2",        es: "Día 1 → Día 2" },
  day1to7:        { en: "Day 1 → Day 7",        es: "Día 1 → Día 7" },
  day1to30:       { en: "Day 1 → Day 30",       es: "Día 1 → Día 30" },

  // Games Labels
  totalGames:     { en: "Total",                es: "Totales" },
  thisWeek:       { en: "This week",            es: "Esta semana" },
  thisMonth:      { en: "This month",           es: "Este mes" },
  avgScore:       { en: "Avg. score",           es: "Puntaje prom." },
  avgRound:       { en: "Avg. round",           es: "Ronda prom." },
  chart14d:       { en: "Games — last 14 days", es: "Jugadas — últimos 14 días" },

  // Score distrib Labels
  range:          { en: "Range",                es: "Rango" },

  // Transaction type names
  submitScore:    { en: "Submit Score",         es: "Enviar Puntaje" },
  setUsername:    { en: "Set Username",         es: "Registrar Usuario" },
  readLeaderboard:{ en: "Leaderboard Read",     es: "Lectura de Leaderboard" },
  rerollRestartFee:{ en: "Reroll/Restart Fee",   es: "Pago Reroll/Restart" },
  winnerPayout:   { en: "Winner Payout",        es: "Pago a Ganador" },
  operatorSetup:  { en: "Operator Maintenance", es: "Mantenimiento Operador" },
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

const OPERATOR_ADDRESS = "0x0419F23541408EEcab6EC4Bd96a454EE8A1dD1BE";
const USDT_ADDRESS = "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/* ── Helpers ── */
const pc = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
function daysAgo(ts: number, n: number) { return ts * 1000 > Date.now() - n * 86400000; }
function fmt(n: number) { return n.toLocaleString("en-US"); }
function fmtUSDT(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`; }
function fmtCelo(n: number) { return `${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} CELO`; }
function fmtPct(n: number) { return `${Math.round(n * 100)}%`; }
function fmtPctDec(n: number) { return `${(n * 100).toFixed(1)}%`; }

/* ═══════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════ */
export default function StatsPage() {
  useUnlockScroll();
  const l = useLang();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [leaderboardTxs, setLeaderboardTxs] = useState<any[]>([]);
  const [operatorTxs, setOperatorTxs] = useState<any[]>([]);
  const [operatorUsdtTxs, setOperatorUsdtTxs] = useState<any[]>([]);
  const [operatorCeloBalance, setOperatorCeloBalance] = useState<bigint>(BigInt(0));
  const [operatorUsdtBalance, setOperatorUsdtBalance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState(true);

  // Web analytics (Mixpanel) state — disabled, not in use.
  /*
  const [webData, setWebData] = useState<{
    countries: { name: string; count: number; pct: number }[];
    devices:   { name: string; count: number; pct: number }[];
    browsers:  { name: string; count: number; pct: number }[];
    referrers: { name: string; count: number; pct: number }[];
    visitors30d: number;
    visitors7d:  number;
    sessions30d: number;
    configured?: boolean;
    note?: string;
  } | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  */

  // Web analytics (Mixpanel) disabled — not in use. The /api/web-analytics
  // endpoint and this fetch are kept commented for easy re-enablement.
  /*
  useEffect(() => {
    fetch("/api/web-analytics")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setWebData(data);
        } else {
          setWebData({ countries: [], devices: [], browsers: [], referrers: [], visitors30d: 0, visitors7d: 0, sessions30d: 0 });
        }
      })
      .catch(() => {
        setWebData({ countries: [], devices: [], browsers: [], referrers: [], visitors30d: 0, visitors7d: 0, sessions30d: 0 });
      })
      .finally(() => setWebLoading(false));
  }, []);
  */

  useEffect(() => {
    (async () => {
      try {
        // 1. Fetch scores — paginated via getScoresRange
        try {
          const total = Number(await pc.readContract({
            address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
            abi: MINICARD_LEADERBOARD_ABI,
            functionName: "getScoresCount",
          }));

          if (total > 0) {
            const PAGE_SIZE = 100;
            const allRaw: any[] = [];
            for (let offset = 0; offset < total; offset += PAGE_SIZE) {
              const limit = Math.min(PAGE_SIZE, total - offset);
              const page = (await pc.readContract({
                address: LEADERBOARD_CONTRACT_ADDRESS as `0x${string}`,
                abi: MINICARD_LEADERBOARD_ABI,
                functionName: "getScoresRange",
                args: [BigInt(offset), BigInt(limit)],
              })) as any[];
              allRaw.push(...page);
            }
            setScores(allRaw.map((e: any) => ({
              player: e.player, score: Number(e.score), round: Number(e.round), timestamp: Number(e.timestamp),
            })));
          }
        } catch (err) {
          console.error("Error reading contract scores:", err);
        }

        // 2. Fetch Operator Celo balance
        try {
          const celoBal = await pc.getBalance({ address: OPERATOR_ADDRESS });
          setOperatorCeloBalance(celoBal);
        } catch (err) {
          console.error("Error fetching Operator Celo balance:", err);
        }

        // 3. Fetch Operator USDT balance
        try {
          const usdtBal = await pc.readContract({
            address: USDT_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [OPERATOR_ADDRESS],
          }) as bigint;
          setOperatorUsdtBalance(usdtBal);
        } catch (err) {
          console.error("Error fetching Operator USDT balance:", err);
        }

        // 4. Fetch Leaderboard tx list from Blockscout
        try {
          const res = await fetch(
            `https://celo.blockscout.com/api?module=account&action=txlist&address=${LEADERBOARD_CONTRACT_ADDRESS}&startblock=0&endblock=99999999&sort=asc`
          );
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            setLeaderboardTxs(json.result);
          }
        } catch (err) {
          console.error("Error fetching Leaderboard tx list:", err);
        }

        // 5. Fetch Operator tx list from Blockscout
        try {
          const res = await fetch(
            `https://celo.blockscout.com/api?module=account&action=txlist&address=${OPERATOR_ADDRESS}&startblock=0&endblock=99999999&sort=asc`
          );
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            setOperatorTxs(json.result);
          }
        } catch (err) {
          console.error("Error fetching Operator tx list:", err);
        }

        // 6. Fetch Operator USDT transfers from Blockscout
        try {
          const res = await fetch(
            `https://celo.blockscout.com/api?module=account&action=tokentx&address=${OPERATOR_ADDRESS}&startblock=0&endblock=99999999&sort=asc`
          );
          const json = await res.json();
          if (json.status === "1" && Array.isArray(json.result)) {
            setOperatorUsdtTxs(json.result.filter((t: any) => t.contractAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()));
          }
        } catch (err) {
          console.error("Error fetching Operator USDT transfers:", err);
        }

      } catch (err) {
        console.error("Global Stats fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    if (scores.length === 0 && leaderboardTxs.length === 0) return null;
    const now = Date.now() / 1000;
    
    // Fallback timestamps for scores in case they are missing
    const scoresWithTs = scores.map(s => ({
      ...s,
      timestamp: s.timestamp || (now - 86400 * 2)
    }));

    const uniquePlayers = new Set(scoresWithTs.map((s) => s.player.toLowerCase()));
    const today = scoresWithTs.filter((s) => daysAgo(s.timestamp, 1));
    const week = scoresWithTs.filter((s) => daysAgo(s.timestamp, 7));
    const month = scoresWithTs.filter((s) => daysAgo(s.timestamp, 30));
    const dauSet = new Set(today.map((s) => s.player.toLowerCase()));
    const wauSet = new Set(week.map((s) => s.player.toLowerCase()));
    const mauSet = new Set(month.map((s) => s.player.toLowerCase()));
    const sorted = [...scoresWithTs].sort((a, b) => b.score - a.score);
    const best = sorted[0];
    const avgScore = scoresWithTs.length > 0 ? scoresWithTs.reduce((a, s) => a + s.score, 0) / scoresWithTs.length : 0;
    const avgRound = scoresWithTs.length > 0 ? scoresWithTs.reduce((a, s) => a + s.round, 0) / scoresWithTs.length : 0;
    const maxRound = scoresWithTs.length > 0 ? Math.max(...scoresWithTs.map((s) => s.round)) : 0;
    
    const brackets = [
      { label: "0–100", min: 0, max: 100 }, { label: "100–500", min: 100, max: 500 },
      { label: "500–1K", min: 500, max: 1000 }, { label: "1K–5K", min: 1000, max: 5000 },
      { label: "5K+", min: 5000, max: Infinity },
    ];
    const distrib = brackets.map((b) => ({ ...b, count: scoresWithTs.filter((s) => s.score >= b.min && s.score < b.max).length }));
    
    const gpp: Record<string, number> = {};
    scoresWithTs.forEach((s) => { const k = s.player.toLowerCase(); gpp[k] = (gpp[k] || 0) + 1; });
    const gpValues = Object.values(gpp);
    const avgGamesPerPlayer = gpValues.length > 0 ? gpValues.reduce((a, v) => a + v, 0) / gpValues.length : 0;
    const topPlayers = Object.entries(gpp).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    const playerFirstDay: Record<string, number> = {};
    scoresWithTs.forEach((s) => { const k = s.player.toLowerCase(); const d = Math.floor(s.timestamp / 86400); if (!playerFirstDay[k] || d < playerFirstDay[k]) playerFirstDay[k] = d; });
    const playerDays: Record<string, Set<number>> = {};
    scoresWithTs.forEach((s) => { const k = s.player.toLowerCase(); if (!playerDays[k]) playerDays[k] = new Set(); playerDays[k].add(Math.floor(s.timestamp / 86400)); });
    
    const retCalc = (offset: number) => {
      let eligible = 0, returned = 0;
      for (const [p, fd] of Object.entries(playerFirstDay)) { const td = fd + offset; if (td <= Math.floor(now / 86400)) { eligible++; if (playerDays[p]?.has(td)) returned++; } }
      return { eligible, returned, rate: eligible > 0 ? returned / eligible : 0 };
    };

    const roundBrackets = [
      { label: "Round 1–3", min: 1, max: 3 }, { label: "Round 4–6", min: 4, max: 6 },
      { label: "Round 7–10", min: 7, max: 10 }, { label: "Round 11+", min: 11, max: Infinity },
    ];
    const roundDistrib = roundBrackets.map((b) => ({ ...b, count: scoresWithTs.filter((s) => s.round >= b.min && s.round <= b.max).length }));
    
    const dailyGames: { day: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const ds = Math.floor(now / 86400) - i;
      const count = scoresWithTs.filter((s) => Math.floor(s.timestamp / 86400) === ds).length;
      const d = new Date(ds * 86400 * 1000);
      dailyGames.push({ day: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, count });
    }

    // ── ECONOMY METRICS ──
    const inflows = operatorUsdtTxs.filter(
      (t) => t.to.toLowerCase() === OPERATOR_ADDRESS.toLowerCase() && t.from.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()
    );
    const totalRevenueUSDT = inflows.reduce((sum, t) => sum + Number(t.value) / 1e6, 0);

    const outflows = operatorUsdtTxs.filter(
      (t) => t.from.toLowerCase() === OPERATOR_ADDRESS.toLowerCase() && t.to.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()
    );
    const totalPayoutsUSDT = outflows.reduce((sum, t) => sum + Number(t.value) / 1e6, 0);
    const highestPrizeUSDT = outflows.length > 0 ? Math.max(...outflows.map((t) => Number(t.value) / 1e6)) : 0;

    const celoBalanceNum = Number(operatorCeloBalance) / 1e18;
    const usdtBalanceNum = Number(operatorUsdtBalance) / 1e6;
    const celoPriceUSD = 0.60;
    const treasuryBalanceUSD = usdtBalanceNum + celoBalanceNum * celoPriceUSD;

    const operatorGasSpentWei = operatorTxs
      .filter((t) => t.from.toLowerCase() === OPERATOR_ADDRESS.toLowerCase())
      .reduce((sum, t) => sum + BigInt(t.gasUsed || 0) * BigInt(t.gasPrice || 0), BigInt(0));
    const operatorGasSpentCelo = Number(operatorGasSpentWei) / 1e18;
    const operatorGasSpentUSD = operatorGasSpentCelo * celoPriceUSD;

    const operatorTimestamps = operatorTxs.map((t) => Number(t.timeStamp)).filter((ts) => !isNaN(ts));
    const firstOperatorTxTs = operatorTimestamps.length > 0 ? Math.min(...operatorTimestamps) : 0;
    const daysSinceFirstOperatorTx = firstOperatorTxTs ? Math.max(1, (Date.now() / 1000 - firstOperatorTxTs) / 86400) : 1;

    const dailyExpensesUSD = (operatorGasSpentUSD + totalPayoutsUSDT) / daysSinceFirstOperatorTx;
    const runwayDays = dailyExpensesUSD > 0 ? treasuryBalanceUSD / dailyExpensesUSD : Infinity;

    // ── ON-CHAIN METRICS ──
    const totalTransactions = leaderboardTxs.length + operatorTxs.length;

    const uniqueAddressesSet = new Set<string>();
    leaderboardTxs.forEach((t) => { if (t.from) uniqueAddressesSet.add(t.from.toLowerCase()); });
    operatorTxs.forEach((t) => { if (t.from) uniqueAddressesSet.add(t.from.toLowerCase()); if (t.to) uniqueAddressesSet.add(t.to.toLowerCase()); });
    operatorUsdtTxs.forEach((t) => { if (t.from) uniqueAddressesSet.add(t.from.toLowerCase()); if (t.to) uniqueAddressesSet.add(t.to.toLowerCase()); });
    const activeAddresses = uniqueAddressesSet.size > 0 ? uniqueAddressesSet.size : uniquePlayers.size;

    const playsRegistered = scoresWithTs.length;

    const leaderboardTimestamps = leaderboardTxs.map((t) => Number(t.timeStamp)).filter((ts) => !isNaN(ts));
    const firstLeaderboardTxTs = leaderboardTimestamps.length > 0 ? Math.min(...leaderboardTimestamps) : 0;
    const daysSinceFirstLeaderboardTx = firstLeaderboardTxTs ? Math.floor((Date.now() / 1000 - firstLeaderboardTxTs) / 86400) : 0;
    const firstTxDateFormatted = firstLeaderboardTxTs ? new Date(firstLeaderboardTxTs * 1000).toLocaleDateString() : null;

    const playersGasSpentWei = leaderboardTxs.reduce((sum, t) => sum + BigInt(t.gasUsed || 0) * BigInt(t.gasPrice || 0), BigInt(0)) +
      operatorUsdtTxs.filter((t) => t.from.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()).reduce((sum, t) => sum + BigInt(t.gas || 0) * BigInt(t.gasPrice || 0), BigInt(0));
    const playersGasSpentCelo = Number(playersGasSpentWei) / 1e18;

    const failedTxs = leaderboardTxs.filter((t) => t.isError === "1" || t.txreceipt_status === "0").length +
      operatorTxs.filter((t) => t.isError === "1" || t.txreceipt_status === "0").length;
    const failedTxRate = totalTransactions > 0 ? failedTxs / totalTransactions : 0;

    // Transaction types table
    const txTypes: Record<string, number> = {
      submitScore: 0,
      setUsername: 0,
      readLeaderboard: 0,
      rerollRestartFee: 0,
      winnerPayout: 0,
      operatorSetup: 0,
    };

    leaderboardTxs.forEach((t) => {
      const method = (t.methodId || "").toLowerCase();
      if (method.startsWith("0x09dc4851")) {
        txTypes.submitScore++;
      } else if (method.startsWith("0x87d06196")) {
        txTypes.setUsername++;
      } else {
        txTypes.readLeaderboard++;
      }
    });

    operatorUsdtTxs.forEach((t) => {
      if (t.to.toLowerCase() === OPERATOR_ADDRESS.toLowerCase() && t.from.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()) {
        txTypes.rerollRestartFee++;
      } else if (t.from.toLowerCase() === OPERATOR_ADDRESS.toLowerCase() && t.to.toLowerCase() !== OPERATOR_ADDRESS.toLowerCase()) {
        txTypes.winnerPayout++;
      }
    });

    operatorTxs.forEach((t) => {
      txTypes.operatorSetup++;
    });

    const totalTxsCategorized = Object.values(txTypes).reduce((a, b) => a + b, 0);
    const txTypesTable = [
      { id: "submitScore", count: txTypes.submitScore, pct: totalTxsCategorized > 0 ? txTypes.submitScore / totalTxsCategorized : 0 },
      { id: "setUsername", count: txTypes.setUsername, pct: totalTxsCategorized > 0 ? txTypes.setUsername / totalTxsCategorized : 0 },
      { id: "readLeaderboard", count: txTypes.readLeaderboard, pct: totalTxsCategorized > 0 ? txTypes.readLeaderboard / totalTxsCategorized : 0 },
      { id: "rerollRestartFee", count: txTypes.rerollRestartFee, pct: totalTxsCategorized > 0 ? txTypes.rerollRestartFee / totalTxsCategorized : 0 },
      { id: "winnerPayout", count: txTypes.winnerPayout, pct: totalTxsCategorized > 0 ? txTypes.winnerPayout / totalTxsCategorized : 0 },
      { id: "operatorSetup", count: txTypes.operatorSetup, pct: totalTxsCategorized > 0 ? txTypes.operatorSetup / totalTxsCategorized : 0 },
    ].filter(item => item.count > 0).sort((a, b) => b.count - a.count);

    return {
      totalPlayers: uniquePlayers.size, totalGames: scoresWithTs.length,
      dau: dauSet.size, wau: wauSet.size, mau: mauSet.size,
      gamesToday: today.length, gamesWeek: week.length, gamesMonth: month.length,
      bestScore: best?.score ?? 0, bestRound: best?.round ?? 0,
      avgScore: Math.round(avgScore * 10) / 10, avgRound: Math.round(avgRound * 10) / 10, maxRound,
      distrib, roundDistrib, avgGamesPerPlayer: Math.round(avgGamesPerPlayer * 10) / 10,
      topPlayers, ret1: retCalc(1), ret7: retCalc(7), ret30: retCalc(30),
      dailyGames, maxDaily: Math.max(...dailyGames.map((d) => d.count), 1),

      totalRevenueUSDT,
      totalPayoutsUSDT,
      highestPrizeUSDT,
      celoBalanceNum,
      usdtBalanceNum,
      treasuryBalanceUSD,
      runwayDays,
      totalTransactions,
      activeAddresses,
      playsRegistered,
      daysSinceFirstLeaderboardTx,
      firstTxDateFormatted,
      operatorGasSpentCelo,
      operatorGasSpentUSD,
      playersGasSpentCelo,
      playersGasSpentUSD: playersGasSpentCelo * celoPriceUSD,
      failedTxRate,
      txTypesTable,
    };
  }, [scores, leaderboardTxs, operatorTxs, operatorUsdtTxs, operatorCeloBalance, operatorUsdtBalance]);

  return (
    <main className="min-h-[100dvh] bg-[#0a0420] text-[#e8e6ff] pb-12 felt-bg">
      <div className="max-w-[920px] mx-auto px-4 pt-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <Link href="/" className="btn-chunky btn-orange px-4 py-1 text-sm">
            {t.back[l]}
          </Link>
          <div className="flex-1" />
        </div>

        <h1 className="font-pixel-fat text-4xl text-[#ff9e2c] txt-outline text-center mb-1 relative z-10">
          {t.title[l]}
        </h1>
        <p className="text-center font-pixel text-sm text-gray-400 mb-8 relative z-10">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-pulse mr-1.5 align-middle" />
          {t.live[l]}
        </p>

        {loading ? (
          <div className="flex justify-center py-40 relative z-10">
            <span className="inline-block w-12 h-12 border-4 border-[#ff2e88]/30 border-t-[#ff2e88] rounded-full animate-spin" />
          </div>
        ) : !stats ? (
          <div className="text-center font-pixel text-gray-400 py-20 relative z-10">{t.noData[l]}</div>
        ) : (
          <div className="flex flex-col gap-6 relative z-10">

            {/* 1. HOY */}
            <Section title={t.today[l]}>
              <div className="grid grid-cols-2 gap-2">
                <Card label="DAU" value={stats.dau} />
                <Card label={t.gamesToday[l]} value={stats.gamesToday} />
              </div>
            </Section>

            {/* 2. JUGADORES */}
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
              <div className="mt-2 bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-[1fr_60px] text-[10px] font-pixel text-gray-400 px-3 py-1 border-b border-white/5 bg-white/[0.02]">
                  <span>{t.player[l]}</span><span className="text-right">{t.gamesCol[l]}</span>
                </div>
                {stats.topPlayers.map(([addr, count], i) => (
                  <div key={addr} className="grid grid-cols-[1fr_60px] text-[11px] font-pixel px-3 py-1 border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                    <span className="text-gray-300 truncate">{i + 1}. {addr.slice(0, 6)}...{addr.slice(-4)}</span>
                    <span className="text-right text-white font-pixel-fat">{count}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 3. RETENCIÓN */}
            <Section title={t.retention[l]}>
              <div className="bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-3 text-[10px] font-pixel text-gray-400 px-3 py-1 border-b border-white/5 bg-white/[0.02]">
                  <span>{t.cohort[l]}</span><span className="text-center">{t.returned[l]}</span><span className="text-right">{t.rate[l]}</span>
                </div>
                {[
                  { label: t.day1to2[l], data: stats.ret1 },
                  { label: t.day1to7[l], data: stats.ret7 },
                  { label: t.day1to30[l], data: stats.ret30 },
                ].map((r) => (
                  <div key={r.label} className="grid grid-cols-3 text-[11px] font-pixel px-3 py-1.5 border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                    <span className="text-gray-300">{r.label}</span>
                    <span className="text-center text-gray-300">{r.data.returned} / {r.data.eligible}</span>
                    <span className="text-right text-white font-pixel-fat">{fmtPct(r.data.rate)}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* 4. JUGADAS */}
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
              <div className="mt-3 bg-black/45 rounded-lg border border-white/5 p-3">
                <div className="font-pixel text-[10px] text-gray-400 mb-2">{t.chart14d[l]}</div>
                <div className="flex items-end gap-[4px] h-[60px] px-1">
                  {stats.dailyGames.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="w-full rounded-t bg-[#ff2e88] min-h-[2px] transition-all hover:bg-[#ff5fa8] cursor-pointer" style={{ height: `${Math.max(4, (d.count / stats.maxDaily) * 100)}%` }} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-white text-[8px] font-pixel rounded py-0.5 px-1 whitespace-nowrap z-20">
                        {d.count}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-[4px] mt-1.5 px-1">
                  {stats.dailyGames.filter((_, i) => i % 3 === 0 || i === stats.dailyGames.length - 1).map((d) => (
                    <span key={d.day} className="flex-1 text-[8px] font-pixel text-gray-500 text-center">{d.day}</span>
                  ))}
                </div>
              </div>

              {/* Distribución de Puntajes */}
              <div className="mt-3 bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                <div className="grid grid-cols-[1fr_60px_70px] text-[10px] font-pixel text-gray-400 px-3 py-1 border-b border-white/5 bg-white/[0.02]">
                  <span>{t.range[l]}</span><span className="text-right">{t.gamesCol[l]}</span><span className="text-right">%</span>
                </div>
                {stats.distrib.map((b) => (
                  <div key={b.label} className="grid grid-cols-[1fr_60px_70px] text-[11px] font-pixel px-3 py-1 border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                    <span className="text-gray-300">{b.label}</span>
                    <span className="text-right text-white font-pixel-fat">{b.count}</span>
                    <span className="text-right text-gray-400">{stats.totalGames > 0 ? fmtPct(b.count / stats.totalGames) : "0%"}</span>
                  </div>
                ))}
              </div>

              {/* Rondas Alcanzadas */}
              <div className="mt-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <Card label={t.highestRound[l]} value={stats.maxRound} accent />
                  <Card label={t.bestScore[l]} value={fmt(stats.bestScore)} sub={`${t.roundLabel[l]} ${stats.bestRound}`} accent />
                </div>
                <div className="bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                  {stats.roundDistrib.map((b) => (
                    <div key={b.label} className="grid grid-cols-[1fr_60px_70px] text-[11px] font-pixel px-3 py-1 border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                      <span className="text-gray-300">{b.label}</span>
                      <span className="text-right text-white font-pixel-fat">{b.count}</span>
                      <span className="text-right text-gray-400">{stats.totalGames > 0 ? fmtPct(b.count / stats.totalGames) : "0%"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            {/* 5. ECONOMÍA */}
            <Section title={t.economy[l]}>
              <div className="grid grid-cols-3 gap-2">
                <Card label={t.totalRevenue[l]} value={fmtUSDT(stats.totalRevenueUSDT)} accent />
                <Card label={t.totalPaid[l]} value={fmtUSDT(stats.totalPayoutsUSDT)} />
                <Card label={t.highestPrize[l]} value={fmtUSDT(stats.highestPrizeUSDT)} />
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.treasuryUSDT[l]} value={fmtUSDT(stats.usdtBalanceNum)} />
                <Card label={t.treasuryCELO[l]} value={fmtCelo(stats.celoBalanceNum)} />
              </div>

              <div className="mt-2">
                <Card 
                  label={t.runway[l]} 
                  value={stats.runwayDays === Infinity ? t.infinite[l] : `${fmt(Math.round(stats.runwayDays))} ${t.days[l]}`}
                  sub={t.runwaySub[l]}
                  accent
                />
              </div>

              {/* Runway Per Game */}
              <div className="mt-3 bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                  <span className="font-pixel-fat text-[11px] text-[#00f0ff] uppercase tracking-wider">
                    {t.perGameLabel[l]}
                  </span>
                </div>
                <table className="w-full text-left font-pixel text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/[0.04] bg-black/20">
                      <th className="px-3 py-1">{t.gameTitle[l]}</th>
                      <th className="px-3 py-1 text-center">{t.balanceTitle[l]}</th>
                      <th className="px-3 py-1 text-right">{t.runwayTitle[l]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/[0.02]">
                      <td className="px-3 py-1.5 text-white font-pixel-fat">MiniCard</td>
                      <td className="px-3 py-1.5 text-center text-gray-300">
                        {fmtUSDT(stats.treasuryBalanceUSD)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-[#ff9e2c] font-pixel-fat">
                        {stats.runwayDays === Infinity ? t.infinite[l] : `${fmt(Math.round(stats.runwayDays))} ${t.days[l]}`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 6. ON-CHAIN */}
            <Section title={t.onchain[l]}>
              <div className="grid grid-cols-2 gap-2">
                <Card label={t.totalTx[l]} value={fmt(stats.totalTransactions)} />
                <Card label={t.activeAddresses[l]} value={fmt(stats.activeAddresses)} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.playsOnchain[l]} value={fmt(stats.playsRegistered)} />
                <Card 
                  label={t.daysOnchain[l]} 
                  value={stats.daysSinceFirstLeaderboardTx} 
                  sub={stats.firstTxDateFormatted ? `${t.sinceLabel[l]} ${stats.firstTxDateFormatted}` : ""} 
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.usdtInflow[l]} value={fmtUSDT(stats.totalRevenueUSDT)} />
                <Card label={t.usdtOutflow[l]} value={fmtUSDT(stats.totalPayoutsUSDT)} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Card label={t.gasOperator[l]} value={fmtCelo(stats.operatorGasSpentCelo)} sub={fmtUSDT(stats.operatorGasSpentUSD)} />
                <Card label={t.gasPlayers[l]} value={fmtCelo(stats.playersGasSpentCelo)} sub={fmtUSDT(stats.playersGasSpentUSD)} />
              </div>
              <div className="mt-2">
                <Card label={t.failedTxRate[l]} value={fmtPctDec(stats.failedTxRate)} accent={stats.failedTxRate > 0.05} />
              </div>

              {/* Transaction Types Table */}
              <div className="mt-3 bg-black/45 rounded-lg border border-white/5 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-white/5 bg-white/[0.02]">
                  <span className="font-pixel-fat text-[11px] text-[#00f0ff] uppercase tracking-wider">
                    {t.txTableTitle[l]}
                  </span>
                </div>
                <table className="w-full text-left font-pixel text-[11px]">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/[0.04] bg-black/20">
                      <th className="px-3 py-1">{t.txTypeCol[l]}</th>
                      <th className="px-3 py-1 text-center">{t.txCountCol[l]}</th>
                      <th className="px-3 py-1 text-right">{t.txPctCol[l]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.txTypesTable.map((item) => (
                      <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                        <td className="px-3 py-1.5 text-gray-300 font-pixel">
                          {t[item.id as keyof typeof t]?.[l] || item.id}
                        </td>
                        <td className="px-3 py-1.5 text-center text-white font-pixel-fat">
                          {fmt(item.count)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-400">
                          {fmtPctDec(item.pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 7. CONTRATOS */}
            <Section title={t.contracts[l]}>
              <ContractRow label="Leaderboard" address={LEADERBOARD_CONTRACT_ADDRESS} />
              <ContractRow label="USDT (Celo)" address={USDT_ADDRESS} />
              <ContractRow label={t.operator[l]} address={OPERATOR_ADDRESS} />
            </Section>

            {/* 8. ANALÍTICA WEB (Mixpanel) — disabled, not in use.
            <Section title={t.webAnalytics[l]}>
              {webLoading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
                  <span className="font-pixel text-[11px] text-gray-500">Loading Web Analytics...</span>
                </div>
              ) : !webData ? (
                <div className="bg-black/40 rounded-lg border border-dashed border-white/10 p-4 text-center flex flex-col gap-2">
                  <span className="font-pixel-fat text-[12px] text-gray-500">📡 Connecting...</span>
                  <p className="font-pixel text-[10px] text-gray-500 leading-relaxed">Could not reach analytics endpoint.</p>
                </div>
              ) : (
                <>
                  {webData.configured === false && (
                    <div className="bg-[#ff9e2c]/15 border border-[#ff9e2c]/30 rounded-lg p-3 mb-3 text-center">
                      <span className="font-pixel-fat text-[11px] text-[#ff9e2c] block mb-1">⚠️ Modo Demo Activado</span>
                      <p className="font-pixel text-[9px] text-gray-300 leading-relaxed">
                        Para cargar estadísticas reales en vivo, configura las variables de entorno{" "}
                        <code className="text-[#ff2e88]">MIXPANEL_SERVICE_ACCOUNT_USER</code>,{" "}
                        <code className="text-[#ff2e88]">MIXPANEL_SERVICE_ACCOUNT_SECRET</code> y{" "}
                        <code className="text-[#ff2e88]">MIXPANEL_PROJECT_ID</code> en Cloudflare Pages (como plaintext, no encrypted secrets).
                      </p>
                    </div>
                  )}

                  {webData.configured === true && webData.note && (
                    <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-3 text-center">
                      <span className="font-pixel text-[10px] text-gray-400 leading-relaxed">
                        {webData.note}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Card label={t.visitors7d[l]} value={fmt(webData.visitors7d)} />
                    <Card label={t.visitors30d[l]} value={fmt(webData.visitors30d)} />
                    <Card label={t.monthlySessions[l]} value={fmt(webData.sessions30d)} />
                    {webData.visitors30d > 0 && stats && (
                      <Card
                        label={t.walletConnRate[l]}
                        value={fmtPctDec(stats.activeAddresses / webData.visitors30d)}
                        accent
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                    <BreakdownBars title={t.topCountries[l]} color="#ff9e2c" items={webData.countries} />
                    <BreakdownBars title={t.deviceDistrib[l]} color="#00f0ff" items={webData.devices} />
                    <BreakdownBars title={t.topBrowsers[l]} color="#ff2e88" items={webData.browsers} />
                    <BreakdownBars title={t.topReferrers[l]} color="#00f0ff" items={webData.referrers} />
                  </div>
                </>
              )}
            </Section>
            */}

          </div>
        )}

        {/* Footer info — legal + support links required for MiniPay listing */}
        <div className="text-center mt-12 mb-6 relative z-10 flex flex-col items-center gap-2">
          <div className="font-pixel text-xs text-gray-500">
            MiniCard · Celo Mainnet · Powered by MiniPay
          </div>
          <div className="flex items-center gap-2">
            <Link href="/legal/terms" className="font-pixel text-[10px] text-gray-500 hover:text-[#00f0ff] transition-colors">
              Terms
            </Link>
            <span className="text-gray-700 text-[10px]">·</span>
            <Link href="/legal/privacy" className="font-pixel text-[10px] text-gray-500 hover:text-[#00f0ff] transition-colors">
              Privacy
            </Link>
            <span className="text-gray-700 text-[10px]">·</span>
            <Link href="/support" className="font-pixel text-[10px] text-gray-500 hover:text-[#00f0ff] transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ── Sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-black/35 backdrop-blur-[2px] rounded-xl border border-white/5 p-4 flex flex-col gap-3 shadow-md">
      <h2 className="font-pixel-fat text-base text-[#00f0ff] flex items-center gap-2">
        <span className="flex-1 h-px bg-[#00f0ff]/20" />
        {title}
        <span className="flex-1 h-px bg-[#00f0ff]/20" />
      </h2>
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </section>
  );
}

function Card({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-black/40 rounded-lg border border-white/5 px-3 py-2.5 flex flex-col items-center justify-center text-center shadow-sm">
      <span className="font-pixel text-[10px] text-gray-400 uppercase tracking-wider leading-none mb-1">{label}</span>
      <span className={`font-pixel-fat text-xl leading-none mt-0.5 ${accent ? "text-[#ff9e2c]" : "text-white"}`}>{value}</span>
      {sub && <span className="font-pixel text-[9px] text-gray-500 mt-1 leading-tight">{sub}</span>}
    </div>
  );
}

function ContractRow({ label, address }: { label: string; address: string }) {
  return (
    <a
      href={`https://celo.blockscout.com/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-black/40 rounded-lg border border-white/5 px-3 py-2.5 mb-1.5 hover:border-[#ff2e88]/30 transition-all group shadow-sm hover:scale-[1.01]"
    >
      <span className="font-pixel text-[11px] text-gray-300 w-[90px] shrink-0">{label}</span>
      <span className="font-pixel text-[12px] text-[#ff2e88] group-hover:text-[#ff5fa8] truncate flex-1">
        {address}
      </span>
      <span className="text-gray-500 text-xs">↗</span>
    </a>
  );
}

function BreakdownBars({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: { name: string; count: number; pct: number }[];
}) {
  return (
    <div className="bg-black/35 rounded-lg border border-white/5 p-2 flex flex-col gap-1">
      <span className="font-pixel-fat text-[10px] text-gray-400 border-b border-white/5 pb-1 mb-1 block uppercase">
        {title}
      </span>
      {items.length === 0 ? (
        <span className="font-pixel text-[9px] text-gray-600 py-2 text-center">—</span>
      ) : (
        items.map((c) => (
          <div key={c.name} className="flex flex-col gap-0.5 font-pixel text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-400 truncate">{c.name}</span>
              <span className="text-white font-pixel-fat">{fmtPct(c.pct)}</span>
            </div>
            <div className="w-full bg-white/[0.03] h-1.5 rounded overflow-hidden">
              <div className="h-full rounded" style={{ width: `${c.pct * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
