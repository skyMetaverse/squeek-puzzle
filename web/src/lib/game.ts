// 文件作用：游戏规则的前端实现（棋盘解码、走一步、判断通关、编码提交数据）。
//
// 为什么要在前端再实现一遍规则：合约只负责"校验"，玩家必须先在本地流畅地玩。
// 两边的规则必须完全一致，否则会出现"本地显示通关但提交被拒"。
// 所以这里的 step() 逐行对应 SqueekPuzzle._apply，改动时两边要一起改。

export const SIZE = 6;
export const CELLS = SIZE * SIZE;
export const BOX_COUNT = 3;
export const ROUNDS_PER_LEVEL = 48;

/** 方向编码与合约一致：0=上 1=右 2=下 3=左 */
export type Dir = 0 | 1 | 2 | 3;

export const DELTA: Record<Dir, number> = { 0: -SIZE, 1: 1, 2: SIZE, 3: -1 };

export const DIR_KEYS: Record<string, Dir> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  w: 0,
  d: 1,
  s: 2,
  a: 3,
  W: 0,
  D: 1,
  S: 2,
  A: 3,
};

export interface Level {
  index: bigint;
  certifiedRound: bigint;
  startRound: bigint;
  endRound: bigint;
  seed: `0x${string}`;
  walls: bigint;
  boxes: bigint;
  targets: bigint;
  player: number;
  solved: bigint;
}

/** 玩家侧的棋盘状态：仓鼠位置 + 三颗坚果的位置（数组保持顺序，动画才不会跳） */
export interface Play {
  player: number;
  nuts: number[];
}

export function bitSet(bits: bigint, cell: number): boolean {
  return ((bits >> BigInt(cell)) & 1n) === 1n;
}

export function cellsOf(bits: bigint): number[] {
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (bitSet(bits, i)) out.push(i);
  return out;
}

export function xOf(cell: number): number {
  return cell % SIZE;
}

export function yOf(cell: number): number {
  return Math.floor(cell / SIZE);
}

/**
 * 走一步。非法返回 null（撞墙、推不动）。
 * 与合约 _apply 完全一致：先判断目标格，再判断是否需要推坚果。
 */
export function step(walls: bigint, play: Play, dir: Dir): Play | null {
  const delta = DELTA[dir];
  const next = play.player + delta;

  // 越界与左右跨行：合约靠外圈墙兜底，这里显式挡一次，逻辑等价但更直白
  if (next < 0 || next >= CELLS) return null;
  if (dir === 1 && xOf(play.player) === SIZE - 1) return null;
  if (dir === 3 && xOf(play.player) === 0) return null;
  if (bitSet(walls, next)) return null;

  const nutIndex = play.nuts.indexOf(next);
  if (nutIndex >= 0) {
    const beyond = next + delta;
    if (beyond < 0 || beyond >= CELLS) return null;
    if (bitSet(walls, beyond)) return null;
    if (play.nuts.includes(beyond)) return null;
    const nuts = play.nuts.slice();
    nuts[nutIndex] = beyond;
    return { player: next, nuts };
  }

  return { player: next, nuts: play.nuts };
}

export function isSolved(targets: bigint, play: Play): boolean {
  return play.nuts.every((cell) => bitSet(targets, cell));
}

/** 提交格式：每个字节一个方向 */
export function encodeMoves(moves: Dir[]): `0x${string}` {
  let hex = "0x";
  for (const m of moves) hex += m.toString(16).padStart(2, "0");
  return hex as `0x${string}`;
}

export function initialPlay(level: Level): Play {
  return { player: level.player, nuts: cellsOf(level.boxes) };
}

/** 关卡进度：已认证轮次在本关 48 轮里走了多少 */
export function levelProgress(level: Level): number {
  const span = Number(level.endRound - level.startRound);
  const done = Number(level.certifiedRound - level.startRound);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, done / span));
}
