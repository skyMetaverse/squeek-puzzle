// 文件作用：统一的卡片容器，保证所有面板的边框、圆角、内边距一致。
import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
  title,
  hint,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  hint?: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-panel/80 backdrop-blur-sm ${className}`}>
      {title && (
        <header className="flex items-baseline justify-between gap-3 border-b border-line/70 px-4 py-3">
          <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.18em] text-white/90">
            {title}
          </h2>
          {hint && <div className="font-mono text-[11px] text-muted">{hint}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
