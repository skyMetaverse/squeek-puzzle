// 文件作用：规则说明弹窗。
// 除了玩法，这里也是"数据来源与可信度"的公示处：
// 玩家需要知道关卡不是我们编的，而是由 SqueekCore 已结算轮次决定的。
import { useEffect } from "react";
import { Rich } from "./Rich";
import { CHAIN_ID, CORE_ADDRESS, EXPLORER_URL, PUZZLE_ADDRESS } from "../lib/config";
import { shortAddress } from "../lib/format";
import { useI18n } from "../lib/i18n";

export function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();

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
      role="dialog"
      aria-modal="true"
      aria-label={t("rules.title")}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel p-6 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">{t("rules.title")}</h2>
          <button
            onClick={onClose}
            aria-label={t("rules.close")}
            className="shrink-0 rounded-lg border border-line px-2 py-1 font-mono text-xs text-muted transition hover:text-white"
          >
            ESC
          </button>
        </div>

        <div className="space-y-4 font-mono text-[13px] leading-relaxed text-white/75">
          <p>
            <Rich text={t("rules.goal")} />
          </p>
          <p>
            <Rich text={t("rules.controls")} />
          </p>

          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-muted">
              {t("rules.seedTitle")}
            </p>
            <p>
              <Rich text={t("rules.seedBody")} />
            </p>
          </div>

          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-2 font-display text-xs uppercase tracking-[0.2em] text-muted">
              {t("rules.scoreTitle")}
            </p>
            <p>
              <Rich text={t("rules.scoreBody")} />
            </p>
          </div>

          <div className="space-y-1.5 rounded-xl border border-line bg-ink/60 p-3">
            <p className="mb-1 font-display text-xs uppercase tracking-[0.2em] text-muted">
              {t("rules.addresses")}
            </p>
            <Row label="SqueekPuzzle" value={PUZZLE_ADDRESS} />
            <Row label="SqueekCore" value={CORE_ADDRESS} />
            <Row label="Chain ID" value={String(CHAIN_ID)} short={false} />
            {EXPLORER_URL && (
              <a
                href={`${EXPLORER_URL}/address/${PUZZLE_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-mint underline decoration-dotted"
              >
                {t("rules.viewExplorer")}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 一行"标签 + 值"。只有地址需要缩写，Chain ID 这类短值要原样显示。 */
function Row({ label, value, short = true }: { label: string; value: string; short?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="truncate text-white/80" title={value}>
        {short ? shortAddress(value, 8, 6) : value}
      </span>
    </div>
  );
}
