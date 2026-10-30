// 文件作用：应用主界面与游戏流程编排。
//
// 结构：
//   顶部（品牌 + 语言 + 网络 + 钱包）→ 左侧棋盘区（关卡信息、棋盘、操作、提交）→ 右侧信息区（我的成绩、排行榜、说明）
//
// 关键流程：
//   1. usePuzzle 拉取当前关卡（合约 board()）与排行榜；
//   2. 玩家在本地用 game.ts 的规则走棋，本地状态完全独立于链；
//   3. 通关后用一笔交易提交整条路径，合约重放校验并记录步数；
//   4. 关卡编号变化（已认证轮次跨过 48 的倍数）时自动重置棋盘。
//
// 国际化：所有文案走 useI18n() 的 t()，不要在 JSX 里直接写中文或英文。
import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import { ConnectButton } from "./components/ConnectButton";
import { Dpad } from "./components/Dpad";
import { LangToggle } from "./components/LangToggle";
import { Leaderboard } from "./components/Leaderboard";
import { Panel } from "./components/Panel";
import { Rich } from "./components/Rich";
import { RulesModal } from "./components/RulesModal";
import { SpriteDefs } from "./components/Sprites";
import { usePuzzle } from "./hooks/usePuzzle";
import { useRoundSeconds } from "./hooks/useCoreConfig";
import { useWallet } from "./hooks/useWallet";
import { puzzleAbi } from "./lib/abi";
import { publicClient } from "./lib/client";
import { CORE_ADDRESS, EXPLORER_URL, PUZZLE_ADDRESS } from "./lib/config";
import { formatDuration, readableError, shortAddress } from "./lib/format";
import { useI18n } from "./lib/i18n";
import {
  DIR_KEYS,
  ROUNDS_PER_LEVEL,
  encodeMoves,
  initialPlay,
  isSolved,
  levelProgress,
  step,
  type Dir,
  type Play,
} from "./lib/game";

type Notice = { kind: "info" | "ok" | "err"; text: string } | null;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function App() {
  const { t } = useI18n();
  const wallet = useWallet();
  const { level, best, entries, loading, error, refresh } = usePuzzle(wallet.address);
  const roundSeconds = useRoundSeconds();

  const [frames, setFrames] = useState<Play[]>([]);
  const [moves, setMoves] = useState<Dir[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // 关卡变化时重置棋盘。用 index+seed 作为 key：轮询刷新时对象引用会变，但内容不变，不能重置。
  const levelKey = level ? `${level.index}-${level.seed}` : "";
  useEffect(() => {
    if (!level) return;
    setFrames([initialPlay(level)]);
    setMoves([]);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  const play = frames.length > 0 ? frames[frames.length - 1] : null;
  const solved = Boolean(level && play && isSolved(level.targets, play));

  const move = useCallback(
    (dir: Dir) => {
      if (!level || !play || solved) return;
      const next = step(level.walls, play, dir);
      if (!next) return;
      setFrames((f) => [...f, next]);
      setMoves((m) => [...m, dir]);
    },
    [level, play, solved],
  );

  const undo = useCallback(() => {
    setFrames((f) => (f.length > 1 ? f.slice(0, -1) : f));
    setMoves((m) => (m.length > 0 ? m.slice(0, -1) : m));
  }, []);

  const reset = useCallback(() => {
    if (!level) return;
    setFrames([initialPlay(level)]);
    setMoves([]);
    setNotice(null);
  }, [level]);

  // 键盘操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rulesOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = DIR_KEYS[e.key];
      if (dir !== undefined) {
        e.preventDefault();
        move(dir);
        return;
      }
      if (e.key === "z" || e.key === "Z") undo();
      if (e.key === "r" || e.key === "R") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, undo, reset, rulesOpen]);

  const submit = useCallback(async () => {
    if (!level || !solved || moves.length === 0) return;
    setSubmitting(true);
    setNotice({ kind: "info", text: t("notice.checking") });
    try {
      // 提交前重新确认关卡没变：读关卡和发交易之间可能刚好换关，
      // 那种情况下合约会以 LevelNotOpen 拒绝，先拦一次能省掉一笔失败交易。
      const stillCurrent = await publicClient.readContract({
        address: PUZZLE_ADDRESS,
        abi: puzzleAbi,
        functionName: "currentLevelIndex",
      });
      if (stillCurrent !== level.index) {
        setNotice({ kind: "err", text: t("notice.levelEnded") });
        refresh();
        return;
      }
      setNotice({ kind: "info", text: t("notice.waitingWallet") });
      const hash = await wallet.sendSubmit(level.index, encodeMoves(moves));
      setNotice({ kind: "info", text: t("notice.sent", { hash: shortAddress(hash) }) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 });
      if (receipt.status === "success") {
        setNotice({ kind: "ok", text: t("notice.confirmed", { moves: moves.length }) });
        refresh();
      } else {
        setNotice({ kind: "err", text: t("notice.rejected") });
      }
    } catch (e) {
      setNotice({ kind: "err", text: readableError(e, t) });
    } finally {
      setSubmitting(false);
    }
  }, [level, solved, moves, wallet, refresh, t]);

  const progress = level ? levelProgress(level) : 0;
  const doneRounds = level ? Number(level.certifiedRound - level.startRound) : 0;
  const remainingRounds = level ? Number(level.endRound - level.certifiedRound) : 0;
  const isConfigured = PUZZLE_ADDRESS.toLowerCase() !== ZERO_ADDRESS;

  // 合约限制单次提交最多 200 步（MAX_MOVES），超了会直接 revert
  const withinMoveLimit = moves.length <= 200;
  const beatsBest = best === 0n || BigInt(moves.length) < best;
  const canSubmit =
    Boolean(solved && wallet.address && !wallet.wrongChain && beatsBest && withinMoveLimit && isConfigured) &&
    !submitting;

  return (
    <div className="min-h-screen bg-ink-2 text-white">
      <SpriteDefs />
      <div className="dot-grid min-h-screen">
        <div className="mx-auto max-w-5xl px-4 pb-14 pt-6 sm:px-6 lg:pt-8">
          <Header wallet={wallet} onRules={() => setRulesOpen(true)} />

          {!isConfigured && (
            <div className="mt-5 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 font-mono text-xs text-gold">
              {t("app.configMissing")}
            </div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            {/* 游戏区 */}
            <div className="rounded-2xl border border-line bg-panel/80 p-4 backdrop-blur-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">Level</p>
                  <p className="font-display text-[34px] font-semibold leading-none tabular-nums">
                    {level ? `#${level.index.toString().padStart(3, "0")}` : "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                    {t("level.progress")}
                  </p>
                  <p className="font-mono text-xs tabular-nums text-white/80">
                    {t("level.rounds", { done: doneRounds, total: ROUNDS_PER_LEVEL })}
                    <span className="ml-2 hidden text-muted sm:inline">
                      {t("level.timeLeft", { duration: formatDuration(remainingRounds * roundSeconds, t) })}
                    </span>
                  </p>
                </div>
              </div>

              <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold transition-all duration-700"
                  style={{ width: `${Math.max(1, progress * 100)}%` }}
                />
              </div>

              <div className="mt-4 w-full">
                {error && (
                  <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-[11px] text-red-300">
                    {t("level.loadFailed")}：{error}
                    <button onClick={refresh} className="ml-2 underline decoration-dotted">
                      {t("level.retry")}
                    </button>
                  </div>
                )}
                {level && play ? (
                  <Board level={level} play={play} solved={solved} />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-line bg-ink-2 px-6 text-center font-mono text-xs text-muted">
                    {loading ? t("board.emptyHint") : t("level.none")}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-line bg-ink/60 px-3 py-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {t("controls.moves")}
                    </span>
                    <span className="ml-2 font-mono text-sm tabular-nums text-white">{moves.length}</span>
                  </div>
                  <button
                    onClick={undo}
                    disabled={moves.length === 0}
                    className="rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-xs text-white/75 transition hover:border-gold/50 hover:text-gold disabled:opacity-30"
                  >
                    {t("controls.undo")}
                  </button>
                  <button
                    onClick={reset}
                    disabled={moves.length === 0}
                    className="rounded-lg border border-line bg-panel-2 px-3 py-2 font-mono text-xs text-white/75 transition hover:border-gold/50 hover:text-gold disabled:opacity-30"
                  >
                    {t("controls.reset")}
                  </button>
                </div>
                <p className="hidden font-mono text-[10px] text-muted sm:block">{t("controls.hint")}</p>
              </div>

              <div className="mt-3 flex justify-center md:hidden">
                <Dpad onMove={move} disabled={solved || !play} />
              </div>

              <div className="mt-4">
                <SubmitArea
                  solved={solved}
                  moves={moves.length}
                  best={best}
                  beatsBest={beatsBest}
                  canSubmit={canSubmit}
                  submitting={submitting}
                  connected={Boolean(wallet.address)}
                  wrongChain={wallet.wrongChain}
                  hasProvider={wallet.hasProvider}
                  onConnect={() => void wallet.connect()}
                  onSwitch={() => void wallet.switchChain()}
                  onSubmit={() => void submit()}
                />
                {notice && (
                  <p
                    className={`mt-2 break-all font-mono text-[11px] ${
                      notice.kind === "err"
                        ? "text-red-300"
                        : notice.kind === "ok"
                          ? "text-mint"
                          : "text-muted"
                    }`}
                  >
                    {notice.text}
                  </p>
                )}
                {wallet.error && <p className="mt-2 font-mono text-[11px] text-red-300">{wallet.error}</p>}
              </div>
            </div>

            {/* 信息区 */}
            <aside className="space-y-4">
              <Panel title={t("panel.myScore")}>
                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label={t("panel.bestThisLevel")}
                    value={best > 0n ? t("moves.value", { moves: best.toString() }) : "—"}
                    accent
                  />
                  <Metric label={t("panel.solvers")} value={level ? level.solved.toString() : "—"} />
                </div>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">{t("panel.scoreNote")}</p>
              </Panel>

              <Panel title={t("panel.leaderboard")} hint={t("panel.fewestFirst")}>
                <Leaderboard entries={entries} me={wallet.address} />
              </Panel>

              <Panel title={t("panel.aboutLevel")}>
                <ul className="space-y-2 font-mono text-[11px] leading-relaxed text-muted">
                  <li>
                    <Rich
                      text={t("panel.seedLine", {
                        round: level ? level.startRound.toString() : "—",
                      })}
                    />
                  </li>
                  <li>{t("panel.sameLevelLine")}</li>
                  <li>
                    <Rich text={t("panel.cadenceLine", { n: ROUNDS_PER_LEVEL })} />
                  </li>
                </ul>
                <button
                  onClick={() => setRulesOpen(true)}
                  className="mt-3 w-full rounded-lg border border-line bg-panel-2 py-2 font-mono text-xs text-white/75 transition hover:border-gold/50 hover:text-gold"
                >
                  {t("panel.fullRules")}
                </button>
              </Panel>
            </aside>
          </div>

          <Footer />
        </div>
      </div>

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

function Header({ wallet, onRules }: { wallet: ReturnType<typeof useWallet>; onRules: () => void }) {
  const { t } = useI18n();

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-3">
        <Mark />
        <div>
          <h1 className="font-display text-[26px] font-semibold uppercase leading-none tracking-[0.22em]">
            Squeek Puzzle
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted">{t("app.tagline")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <LangToggle />
        <button
          onClick={onRules}
          className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted transition hover:border-gold/50 hover:text-gold"
        >
          {t("app.howToPlay")}
        </button>
        <span className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
          SEPOLIA
        </span>
        <ConnectButton wallet={wallet} />
      </div>
    </header>
  );
}

/** 品牌标记：3x3 点阵，呼应 Squeekchain 的 dot-matrix 视觉 */
function Mark() {
  const dots: Array<[number, number]> = [];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) dots.push([x, y]);
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      {dots.map(([x, y]) => {
        const center = x === 1 && y === 1;
        const last = x === 2 && y === 2;
        return (
          <circle
            key={`${x}-${y}`}
            cx={5 + x * 7}
            cy={5 + y * 7}
            r={center ? 3.1 : 2.1}
            fill={center ? "#f2b53c" : last ? "#5be3b0" : "#3a3a47"}
          />
        );
      })}
    </svg>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-ink/50 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums ${accent ? "text-gold" : "text-white/85"}`}>{value}</p>
    </div>
  );
}

function SubmitArea({
  solved,
  moves,
  best,
  beatsBest,
  canSubmit,
  submitting,
  connected,
  wrongChain,
  hasProvider,
  onConnect,
  onSwitch,
  onSubmit,
}: {
  solved: boolean;
  moves: number;
  best: bigint;
  beatsBest: boolean;
  canSubmit: boolean;
  submitting: boolean;
  connected: boolean;
  wrongChain: boolean;
  hasProvider: boolean;
  onConnect: () => void;
  onSwitch: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  if (!solved) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-3 text-center font-mono text-xs text-muted">
        {t("submit.instruction")}
      </div>
    );
  }

  if (!connected) {
    return (
      <button
        onClick={onConnect}
        className="w-full rounded-xl bg-gold py-3 font-display text-base font-semibold uppercase tracking-[0.15em] text-ink transition hover:bg-[#ffc85a]"
      >
        {hasProvider ? t("submit.connect") : t("submit.install")}
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={onSwitch}
        className="w-full rounded-xl border border-gold/60 bg-gold/10 py-3 font-display text-base font-semibold uppercase tracking-[0.15em] text-gold"
      >
        {t("submit.wrongChain")}
      </button>
    );
  }

  if (!beatsBest) {
    return (
      <div className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-center font-mono text-xs text-mint">
        {t("submit.noBetter", { best: best.toString(), moves })}
      </div>
    );
  }

  return (
    <button
      onClick={onSubmit}
      disabled={!canSubmit}
      className="w-full rounded-xl bg-mint py-3 font-display text-base font-semibold uppercase tracking-[0.15em] text-ink transition hover:bg-[#7df0c4] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? t("submit.submitting") : t("submit.button", { moves })}
    </button>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-10 border-t border-line pt-5 font-mono text-[11px] leading-relaxed text-muted">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span>
          SqueekPuzzle <span className="text-white/60">{shortAddress(PUZZLE_ADDRESS, 8, 6)}</span>
        </span>
        <span>
          SqueekCore <span className="text-white/60">{shortAddress(CORE_ADDRESS, 8, 6)}</span>
        </span>
        {EXPLORER_URL && (
          <a
            href={`${EXPLORER_URL}/address/${PUZZLE_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="text-mint underline decoration-dotted"
          >
            {t("footer.explorer")}
          </a>
        )}
      </div>
      <p className="mt-2 max-w-3xl">{t("footer.dataLine")}</p>
    </footer>
  );
}
