// 文件作用：零散格式化与错误信息处理。
// 为什么单独放：地址缩写、错误提示在多个组件里都要用，集中一份避免各写一套。

export function shortAddress(address?: string, head = 6, tail = 4): string {
  if (!address) return "";
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/** 把 viem / 钱包抛出的错误翻译成中文提示，避免把原始栈信息甩给用户 */
export function readableError(error: unknown): string {
  if (!error) return "未知错误";
  const anyError = error as {
    shortMessage?: string;
    message?: string;
    code?: number;
    name?: string;
  };

  if (anyError.code === 4001) return "你在钱包里取消了这笔交易。";
  if (anyError.name === "ContractFunctionExecutionError" && anyError.shortMessage) {
    return anyError.shortMessage;
  }
  if (anyError.shortMessage) return anyError.shortMessage;
  if (anyError.message) {
    // 只取第一行，避免把整段 viem 报错糊在界面上
    return anyError.message.split("\n")[0];
  }
  return "未知错误";
}

export function formatMoves(moves: bigint): string {
  return moves === 0n ? "—" : `${moves.toString()} 步`;
}

/** 把秒数写成"约 3 小时 12 分"这种好读的形式 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "即将换关";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `约 ${totalMinutes} 分钟`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `约 ${hours} 小时` : `约 ${hours} 小时 ${minutes} 分`;
}
