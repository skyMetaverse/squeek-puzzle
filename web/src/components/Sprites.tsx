// 文件作用：棋盘上所有图形（仓鼠、坚果、窝、墙）的 SVG 组件。
// 全部用内联 SVG 而不是图片资源：体积小、可随主题变色、不依赖外部请求。
// 渐变只定义一次（SpriteDefs），避免三个坚果各自重复定义 <defs> 造成 id 冲突。

/** 全局渐变定义，App 里渲染一次即可 */
export function SpriteDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <radialGradient id="nutGrad" cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffe9b5" />
          <stop offset="55%" stopColor="#f2b53c" />
          <stop offset="100%" stopColor="#a9771f" />
        </radialGradient>
        <linearGradient id="furGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0c08a" />
          <stop offset="100%" stopColor="#cf8f55" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** 仓鼠 */
export function Hamster({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {/* 耳朵 */}
      <circle cx="8.5" cy="9" r="4.2" fill="url(#furGrad)" />
      <circle cx="23.5" cy="9" r="4.2" fill="url(#furGrad)" />
      <circle cx="8.5" cy="9" r="2.1" fill="#9a5f36" opacity="0.8" />
      <circle cx="23.5" cy="9" r="2.1" fill="#9a5f36" opacity="0.8" />
      {/* 身体 */}
      <ellipse cx="16" cy="19" rx="11.2" ry="9.4" fill="url(#furGrad)" />
      {/* 肚子 */}
      <ellipse cx="16" cy="21.4" rx="7.2" ry="6.2" fill="#ffe6c6" opacity="0.95" />
      {/* 眼睛 */}
      <circle cx="12" cy="16.4" r="1.75" fill="#241a12" />
      <circle cx="20" cy="16.4" r="1.75" fill="#241a12" />
      <circle cx="12.55" cy="15.8" r="0.55" fill="#fff" opacity="0.9" />
      <circle cx="20.55" cy="15.8" r="0.55" fill="#fff" opacity="0.9" />
      {/* 鼻子 + 嘴 */}
      <circle cx="16" cy="20" r="1.35" fill="#c4626b" />
      <path
        d="M16 21.2v1.4M16 22.6c-.9 0-1.6-.4-1.9-1M16 22.6c.9 0 1.6-.4 1.9-1"
        stroke="#8a4a52"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** 坚果 */
export function Nut({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <ellipse cx="16" cy="17" rx="8.6" ry="10.2" fill="url(#nutGrad)" />
      <path
        d="M16 7.4c-2.9 2.2-4.3 5.4-4.3 9.6s1.4 7.4 4.3 9.6"
        stroke="#7d5514"
        strokeOpacity="0.5"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="12.4" cy="12.4" rx="1.9" ry="2.6" fill="#fff7e2" opacity="0.5" />
    </svg>
  );
}

/** 窝：坚果要推到这里 */
export function Nest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="#f2b53c"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeDasharray="3.4 3.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.1" fill="#f2b53c" fillOpacity="0.28" />
    </svg>
  );
}
