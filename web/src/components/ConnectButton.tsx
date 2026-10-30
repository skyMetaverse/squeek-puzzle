// 文件作用：钱包连接 / 网络切换按钮。
// 三种状态必须区分清楚：没装钱包、未连接、已连接但网络不对。
// 网络不对时不允许发交易，只给"切换网络"入口。
import type { Wallet } from "../hooks/useWallet";
import { shortAddress } from "../lib/format";
import { useI18n } from "../lib/i18n";

const CHAIN_LABEL = "SEPOLIA";

export function ConnectButton({ wallet }: { wallet: Wallet }) {
  const { t } = useI18n();

  if (!wallet.hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="whitespace-nowrap rounded-full border border-line bg-panel px-4 py-2 font-mono text-xs text-white/70 transition hover:border-gold/60 hover:text-gold"
      >
        {t("wallet.install")}
      </a>
    );
  }

  if (wallet.wrongChain) {
    return (
      <button
        onClick={() => void wallet.switchChain()}
        className="whitespace-nowrap rounded-full border border-gold/60 bg-gold/10 px-4 py-2 font-mono text-xs text-gold transition hover:bg-gold/20"
      >
        {t("wallet.switchTo", { chain: CHAIN_LABEL })}
      </button>
    );
  }

  if (wallet.address) {
    return (
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(91,227,176,0.9)]" />
        <span className="font-mono text-xs text-white/80">{shortAddress(wallet.address)}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => void wallet.connect()}
      disabled={wallet.status === "connecting"}
      className="whitespace-nowrap rounded-full bg-gold px-4 py-2 font-display text-sm font-semibold uppercase tracking-wider text-ink transition hover:bg-[#ffc85a] disabled:opacity-60"
    >
      {wallet.status === "connecting" ? t("wallet.connecting") : t("wallet.connect")}
    </button>
  );
}
