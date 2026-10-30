// 文件作用：钱包连接 / 网络切换按钮。
// 三种状态必须区分清楚：没装钱包、未连接、已连接但网络不对。
// 网络不对时不允许发交易，只给"切换网络"入口。
import type { Wallet } from "../hooks/useWallet";
import { CHAIN_ID } from "../lib/config";
import { shortAddress } from "../lib/format";

const CHAIN_LABEL = CHAIN_ID === 11155111 ? "SEPOLIA" : CHAIN_ID === 31337 ? "LOCAL" : `CHAIN ${CHAIN_ID}`;

export function ConnectButton({ wallet }: { wallet: Wallet }) {
  if (!wallet.hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-line bg-panel px-4 py-2 font-mono text-xs text-white/70 transition hover:border-gold/60 hover:text-gold"
      >
        安装钱包
      </a>
    );
  }

  if (wallet.wrongChain) {
    return (
      <button
        onClick={() => void wallet.switchChain()}
        className="rounded-full border border-gold/60 bg-gold/10 px-4 py-2 font-mono text-xs text-gold transition hover:bg-gold/20"
      >
        切换到 {CHAIN_LABEL}
      </button>
    );
  }

  if (wallet.address) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(91,227,176,0.9)]" />
        <span className="font-mono text-xs text-white/80">{shortAddress(wallet.address)}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => void wallet.connect()}
      disabled={wallet.status === "connecting"}
      className="rounded-full bg-gold px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-[#ffc85a] disabled:opacity-60"
    >
      {wallet.status === "connecting" ? "连接中…" : "连接钱包"}
    </button>
  );
}
