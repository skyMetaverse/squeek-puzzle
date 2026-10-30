// 文件作用：移动端方向键。
// 桌面端用键盘，手机上没有方向键，必须给可点的十字键，否则游戏在手机上没法玩。
import type { Dir } from "../lib/game";

const KEY_LABEL: Record<Dir, string> = { 0: "↑", 1: "→", 2: "↓", 3: "←" };

export function Dpad({ onMove, disabled }: { onMove: (dir: Dir) => void; disabled: boolean }) {
  const btn = (dir: Dir, gridArea: string) => (
    <button
      key={dir}
      aria-label={`向${["上", "右", "下", "左"][dir]}移动`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onMove(dir);
      }}
      disabled={disabled}
      style={{ gridArea }}
      className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-panel-2 text-xl text-white/80 transition active:scale-95 active:border-gold/60 active:text-gold disabled:opacity-30"
    >
      {KEY_LABEL[dir]}
    </button>
  );

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateAreas: `". up ." "left down right"`, gridTemplateColumns: "repeat(3, 3.5rem)" }}
    >
      {btn(0, "up")}
      {btn(3, "left")}
      {btn(2, "down")}
      {btn(1, "right")}
    </div>
  );
}
