// 文件作用：本关排行榜。
// 数据来自 Solved 事件日志的聚合结果，只做展示；成绩判定始终以合约的 bestMoves 为准。
import type { Address } from "viem";
import type { Entry } from "../hooks/usePuzzle";
import { shortAddress } from "../lib/format";
import { useI18n } from "../lib/i18n";

export function Leaderboard({ entries, me }: { entries: Entry[]; me?: Address }) {
  const { t } = useI18n();

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs leading-relaxed text-muted">
        {t("leaderboard.empty")}
        <br />
        {t("leaderboard.emptyHint")}
      </p>
    );
  }

  return (
    <ol className="space-y-1">
      {entries.map((entry, i) => {
        const isMe = me && entry.player.toLowerCase() === me.toLowerCase();
        return (
          <li
            key={entry.player}
            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 font-mono text-xs ${
              isMe ? "bg-gold/10 text-gold" : "text-white/75"
            }`}
          >
            <span className="w-4 text-right text-[10px] text-muted">{i + 1}</span>
            <span className="flex-1 truncate">{shortAddress(entry.player)}</span>
            <span className={`tabular-nums ${i === 0 ? "text-gold" : ""}`}>
              {t("moves.value", { moves: entry.moves.toString() })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
