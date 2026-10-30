// 文件作用：中英文切换按钮。
// 用一个两段式开关而不是下拉：只有两种语言，多一步点击没有意义。
import { useI18n, type Lang } from "../lib/i18n";

const OPTIONS: Array<{ lang: Lang; label: string }> = [
  { lang: "zh", label: "中" },
  { lang: "en", label: "EN" },
];

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex shrink-0 overflow-hidden rounded-full border border-line"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          onClick={() => setLang(option.lang)}
          aria-pressed={lang === option.lang}
          className={`shrink-0 whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition ${
            lang === option.lang
              ? "bg-gold text-ink"
              : "text-muted hover:bg-white/5 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
