// 文件作用：规则说明弹窗。
// 除了玩法，这里也是"数据来源与可信度"的公示处：
// 玩家需要知道关卡不是我们编的，而是由 SqueekCore 已结算轮次决定的。
import { useEffect } from "react";
import { CHAIN_ID, CORE_ADDRESS, EXPLORER_URL, PUZZLE_ADDRESS } from "../lib/config";
import { shortAddress } from "../lib/format";

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">怎么玩</h2>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg border border-line px-2 py-1 font-mono text-xs text-muted transition hover:text-white"
          >
            ESC
          </button>
        </div>

        <div className="space-y-4 font-mono text-[13px] leading-relaxed text-white/75">
          <p>
            把 <span className="text-gold">三颗坚果</span> 全部推进{" "}
            <span className="text-gold">虚线窝</span> 里。坚果只能推、不能拉，撞墙或撞到别的坚果就走不动。
          </p>
          <p>
            键盘 <span className="text-white">方向键 / WASD</span>，手机上用方向键。走错了可以撤销或重来。
          </p>

          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-muted">关卡从哪来</p>
            <p>
              每 <span className="text-white">48 个已认证轮次</span>（8 小时）一关，一天三关。关卡种子取自
              SqueekCore 在那一轮结束时的账本位置，在合约里确定性地生成——
              所以全世界同一时间看到的是同一关，而且没人能提前知道下一关长什么样。
            </p>
          </div>

          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-muted">成绩怎么算</p>
            <p>
              解完后用一笔交易提交整条移动路径，合约会把每一步重放一遍：只要有一步行不通、或者最后坚果没全进窝，交易就会失败。
              排行榜按<span className="text-white">步数最少</span>排，同一关可以反复提交更短的解。
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-1 font-display text-xs uppercase tracking-[0.2em] text-muted">合约地址</p>
            <Row label="SqueekPuzzle" value={PUZZLE_ADDRESS} />
            <Row label="SqueekCore" value={CORE_ADDRESS} />
            <Row label="Chain ID" value={String(CHAIN_ID)} />
            {EXPLORER_URL && (
              <a
                href={`${EXPLORER_URL}/address/${PUZZLE_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-mint underline decoration-dotted"
              >
                在区块浏览器查看 →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="truncate text-white/80" title={value}>
        {shortAddress(value, 8, 6)}
      </span>
    </div>
  );
}
