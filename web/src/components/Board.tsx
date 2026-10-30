// 文件作用：6x6 棋盘的渲染。
//
// 实现要点：
// - 背景格用 CSS grid 铺满，坚果和仓鼠用绝对定位 + transform 叠加在上面，
//   这样移动时可以用 CSS transition 平滑过渡，而不是整块重绘。
// - 坚果按数组顺序渲染，位置变化时 React 复用同一个 DOM 节点，动画才不会错位。
import { CELLS, SIZE, bitSet, xOf, yOf, type Level, type Play } from "../lib/game";
import { Hamster, Nest, Nut } from "./Sprites";

interface Props {
  level: Level;
  play: Play;
  solved: boolean;
}

/** 每格占棋盘的比例 */
const CELL_PCT = 100 / SIZE;

function cellBox(cell: number): React.CSSProperties {
  return {
    width: `${CELL_PCT}%`,
    height: `${CELL_PCT}%`,
    transform: `translate(${xOf(cell) * 100}%, ${yOf(cell) * 100}%)`,
  };
}

export function Board({ level, play, solved }: Props) {
  const cells = Array.from({ length: CELLS }, (_, i) => i);

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-2xl border bg-ink-2 transition-colors duration-500 ${
        solved ? "border-mint/45 shadow-[0_0_60px_-18px_rgba(91,227,176,0.55)]" : "border-line"
      }`}
    >
      {/* 背景：墙 / 地板 / 窝 */}
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-6">
        {cells.map((cell) => {
          const isWall = bitSet(level.walls, cell);
          const isTarget = bitSet(level.targets, cell);
          return (
            <div key={cell} className="relative">
              {isWall ? (
                <div className="absolute inset-[2px] rounded-[6px] border border-white/[0.07] bg-[#262631] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.4)]">
                  <div className="absolute inset-0 rounded-[6px] bg-[radial-gradient(circle,rgba(255,255,255,0.09)_1px,transparent_1px)] bg-[length:8px_8px] opacity-70" />
                </div>
              ) : (
                <div className="absolute inset-0 border border-white/[0.03] bg-[#0c0c11]" />
              )}
              {isTarget && (
                <div className="absolute inset-0 flex items-center justify-center p-[18%]">
                  <Nest className="h-full w-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 坚果。外层只负责"定位到某一格"，内层用 inset 留出边距——
          这里不能用百分比 padding：百分比 padding 是按包含块宽度算的，
          会把内容盒压成 0，图形就完全看不见了。 */}
      {play.nuts.map((cell, i) => {
        const onTarget = bitSet(level.targets, cell);
        return (
          <div
            key={`nut-${i}`}
            className="absolute left-0 top-0 will-change-transform"
            style={{
              ...cellBox(cell),
              transition: "transform 130ms cubic-bezier(.2,.8,.2,1)",
            }}
          >
            <div className={`absolute inset-[16%] ${onTarget ? "drop-shadow-[0_0_12px_rgba(242,181,60,0.6)]" : ""}`}>
              <Nut className="h-full w-full" />
              {onTarget && (
                <div className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-mint shadow-[0_0_8px_rgba(91,227,176,0.9)]" />
              )}
            </div>
          </div>
        );
      })}

      {/* 仓鼠 */}
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{ ...cellBox(play.player), transition: "transform 110ms cubic-bezier(.2,.8,.2,1)" }}
      >
        <div className={`absolute inset-[11%] ${solved ? "animate-[bounce_1.4s_ease-in-out_infinite]" : ""}`}>
          <Hamster className="h-full w-full drop-shadow-[0_3px_6px_rgba(0,0,0,0.55)]" />
        </div>
      </div>
    </div>
  );
}
