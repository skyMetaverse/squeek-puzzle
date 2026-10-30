// 文件作用：独立的 6x6 推箱子 BFS 求解器（脚本专用）。
// 与合约里的生成/校验逻辑完全无关，因此可以用它交叉验证"合约生成的关卡确实可解"，
// 也可以用它找出当前关卡的参考解，用于手工验证前端。
export const SIZE = 6;
export const CELLS = 36;
export const DELTA = [-SIZE, 1, SIZE, -1];

export function solve(walls: bigint, boxes: bigint, targets: bigint, player: number): number[] | null {
  const cellsOf = (bits: bigint) => {
    const out: number[] = [];
    for (let i = 0; i < CELLS; i++) if ((bits >> BigInt(i)) & 1n) out.push(i);
    return out;
  };
  const pack = (p: number, nuts: number[]) => p | (nuts[0] << 6) | (nuts[1] << 12) | (nuts[2] << 18);
  const unpack = (state: number): [number, number[]] => [
    state & 0x3f,
    [(state >> 6) & 0x3f, (state >> 12) & 0x3f, (state >> 18) & 0x3f],
  ];
  const start = pack(player, cellsOf(boxes));
  const parent = new Map<number, number>();
  const moveOf = new Map<number, number>();
  parent.set(start, start);
  const queue: number[] = [start];
  const goal = cellsOf(targets).reduce((acc, c) => acc | (1 << c), 0);

  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    const [pos, nuts] = unpack(state);
    const nutBits = nuts.reduce((acc, c) => acc | (1 << c), 0);
    if (nutBits === goal) {
      const path: number[] = [];
      let cursor = state;
      while (cursor !== start) {
        path.push(moveOf.get(cursor)!);
        cursor = parent.get(cursor)!;
      }
      return path.reverse();
    }
    for (let dir = 0; dir < 4; dir++) {
      const delta = DELTA[dir];
      const next = pos + delta;
      if (next < 0 || next >= CELLS) continue;
      if (dir === 1 && pos % SIZE === SIZE - 1) continue;
      if (dir === 3 && pos % SIZE === 0) continue;
      if ((walls >> BigInt(next)) & 1n) continue;
      const nutIndex = nuts.indexOf(next);
      let nextNuts = nuts;
      if (nutIndex >= 0) {
        const beyond = next + delta;
        if (beyond < 0 || beyond >= CELLS) continue;
        if ((walls >> BigInt(beyond)) & 1n) continue;
        if (nuts.includes(beyond)) continue;
        nextNuts = nuts.slice();
        nextNuts[nutIndex] = beyond;
      }
      const sorted = [...nextNuts].sort((a, b) => a - b);
      const encoded = pack(next, sorted);
      if (parent.has(encoded)) continue;
      parent.set(encoded, state);
      moveOf.set(encoded, dir);
      queue.push(encoded);
    }
  }
  return null;
}

export function encodeMoves(moves: number[]): `0x${string}` {
  return `0x${moves.map((m) => m.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}
