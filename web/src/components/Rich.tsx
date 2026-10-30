// 文件作用：把文案里的 **高亮** 标记渲染成金色文字。
// 为什么不用 dangerouslySetInnerHTML：文案来自字典常量，但一旦有人把用户数据塞进来，
// innerHTML 就是注入面。这里只做最朴素的分割，输出的是纯文本节点。
import { Fragment } from "react";

export function Rich({ text, className = "text-gold" }: { text: string; className?: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={className}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
