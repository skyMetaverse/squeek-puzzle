// 文件作用：钱包连接 / 网络切换按钮。
// 三种状态必须区分清楚：没装钱包、未连接、已连接但网络不对。
// 网络不对时禁止发交易，并同时提供切换网络与断开连接入口。
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

  if (wallet.address) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* 错误网络也保留地址和退出按钮，避免用户被困在切换网络这一个入口上。 */}
        {wallet.wrongChain && (
          <button
            type="button"
            onClick={() => void wallet.switchChain()}
            className="whitespace-nowrap rounded-full border border-gold/60 bg-gold/10 px-4 py-2 font-mono text-xs text-gold transition hover:bg-gold/20"
          >
            {t("wallet.switchTo", { chain: CHAIN_LABEL })}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-panel py-1 pl-3 pr-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_6px_rgba(91,227,176,0.9)]" />
          <span className="font-mono text-xs text-white/80" title={wallet.address}>
            {shortAddress(wallet.address)}
          </span>
          <button
            type="button"
            onClick={wallet.disconnect}
            aria-label={t("wallet.disconnect")}
            title={t("wallet.disconnect")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-gold"
          >
            {/* 电源图标：比"×"更明确地表示"断开连接"而不是"关闭弹窗" */}
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 3.5v8" />
              <path d="M6.8 6.6a8 8 0 1 0 10.4 0" />
            </svg>
          </button>
        </div>
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
