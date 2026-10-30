// 文件作用：读取当前关卡、我的最佳成绩、本关排行榜。
//
// 数据来源说明（重要）：
// - 关卡本身来自游戏合约的 board()，它是唯一真值；
// - 排行榜来自 Solved 事件日志，只做展示，不参与任何判定；
// - 任何需要进交易的数值（关卡号、步数）都以合约读数为准，不从这里的历史缓存推断。
import { useCallback, useEffect, useState } from "react";
import { type Address, parseEventLogs } from "viem";
import { puzzleAbi } from "../lib/abi";
import { publicClient } from "../lib/client";
import { DEPLOY_BLOCK, PUZZLE_ADDRESS } from "../lib/config";
import { useI18n } from "../lib/i18n";
import type { Level } from "../lib/game";

export interface Entry {
  player: Address;
  moves: bigint;
}

export interface PuzzleState {
  level: Level | null;
  best: bigint;
  entries: Entry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** 日志回溯窗口：一关是 48 轮，正常不会超过几千个区块，这里留足余量 */
const LOOKBACK = 5_000n;

export function usePuzzle(address?: Address): PuzzleState {
  const { t } = useI18n();
  const [level, setLevel] = useState<Level | null>(null);
  const [best, setBest] = useState<bigint>(0n);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const board = await publicClient.readContract({
          address: PUZZLE_ADDRESS,
          abi: puzzleAbi,
          functionName: "board",
        });
        if (cancelled) return;

        const next: Level = {
          index: board.index,
          certifiedRound: board.certifiedRound,
          startRound: board.startRound,
          endRound: board.endRound,
          seed: board.seed,
          walls: board.walls,
          boxes: board.boxes,
          targets: board.targets,
          player: board.player,
          solved: board.solved,
        };
        setLevel(next);
        setError(null);

        // 我的成绩
        if (address) {
          const mine = await publicClient.readContract({
            address: PUZZLE_ADDRESS,
            abi: puzzleAbi,
            functionName: "bestMoves",
            args: [next.index, address],
          });
          if (!cancelled) setBest(mine);
        } else if (!cancelled) {
          setBest(0n);
        }

        // 本关排行榜：按玩家聚合，取各自最少步数。
        // 回溯范围取 max(部署区块, latest - LOOKBACK)：既不会扫到部署之前，
        // 也不会随着链变长无限扩大查询区间（多数公共 RPC 会拒绝过大的 getLogs 范围）。
        const latest = await publicClient.getBlockNumber();
        const windowStart = latest > LOOKBACK ? latest - LOOKBACK : 0n;
        const from = windowStart > DEPLOY_BLOCK ? windowStart : DEPLOY_BLOCK;
        const logs = await publicClient.getLogs({
          address: PUZZLE_ADDRESS,
          fromBlock: from,
          toBlock: "latest",
        });
        if (cancelled) return;

        // strict: false —— 合约里还有 CoreBound 之类的事件，不能因为解析不了未知事件就整体失败
        const parsed = parseEventLogs({ abi: puzzleAbi, logs, eventName: "Solved", strict: false });
        const bestByPlayer = new Map<string, bigint>();
        for (const log of parsed) {
          const lvl = log.args.level;
          if (lvl === undefined || lvl !== next.index) continue;
          const who = log.args.player;
          const moves = log.args.moves;
          if (!who || moves === undefined) continue;
          const key = who.toLowerCase();
          const prev = bestByPlayer.get(key);
          if (prev === undefined || moves < prev) bestByPlayer.set(key, moves);
        }
        const list: Entry[] = [...bestByPlayer.entries()]
          .map(([player, moves]) => ({ player: player as Address, moves }))
          .sort((a, b) => (a.moves < b.moves ? -1 : a.moves > b.moves ? 1 : 0))
          .slice(0, 10);
        setEntries(list);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        // 关卡生成失败或 RPC 不通时，必须让用户看到"未知"，而不是显示成 0
        setError(e instanceof Error ? e.message : t("level.loadFailed"));
        setLoading(false);
      }
    };

    void load();
    // 轮次前沿会自己走，定期刷新；换关后关卡号变化会自动反映出来
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [address, nonce, t]);

  // 退出立即隐藏个人成绩，不等待下一次 RPC 返回（断网时同样生效）。
  return { level, best: address ? best : 0n, entries, loading, error, refresh };
}
