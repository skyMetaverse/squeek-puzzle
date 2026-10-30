// 文件作用：钱包连接与写交易。
//
// 设计取舍：不引入 wagmi，只用 viem 的 custom transport 直接对接浏览器注入钱包。
// 原因是本游戏只有一个写操作（submit），多一层状态管理只会增加出错面。
//
// 关键点：
// - 链不对时不允许发交易，而是引导用户切换/添加网络；
// - 用户主动断开后保存网站会话标记，刷新与钱包事件都不会自动恢复连接；
// - 每次发交易都重新拿一次 wallet client，避免账户切换后用到过期的账户对象。
import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom, type Address, type Hex } from "viem";
import { puzzleAbi } from "../lib/abi";
import { CHAIN_ID, PUZZLE_ADDRESS, chain } from "../lib/config";
import { useI18n } from "../lib/i18n";

type Status = "idle" | "connecting" | "connected";

const DISCONNECTED_KEY = "squeek-puzzle:wallet-disconnected";

/** 只记住用户是否退出网站，不存地址、凭证或钱包私钥。 */
function wasDisconnected(): boolean {
  try {
    return window.localStorage.getItem(DISCONNECTED_KEY) === "true";
  } catch {
    // 禁用存储时依然允许本次会话正常连接、退出。
    return false;
  }
}

/** 存储不可用时由 hook 内的 ref 继续保护当前会话。 */
function rememberDisconnected(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(DISCONNECTED_KEY, "true");
    else window.localStorage.removeItem(DISCONNECTED_KEY);
  } catch {
    // 隐私模式或存储配额错误不应阻止用户退出。
  }
}

export interface Wallet {
  address?: Address;
  walletChainId?: number;
  status: Status;
  error?: string;
  wrongChain: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  sendSubmit: (level: bigint, moves: Hex) => Promise<Hex>;
}

export function useWallet(): Wallet {
  const { t } = useI18n();
  const [address, setAddress] = useState<Address>();
  const [walletChainId, setWalletChainId] = useState<number>();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const mounted = useRef(true);
  const disconnected = useRef(wasDisconnected());
  // 连接、断开、卸载都会使旧请求失效，防止迟到的 eth_accounts 把已退出的地址填回来。
  const revision = useRef(0);

  const hasProvider = typeof window !== "undefined" && Boolean(window.ethereum);

  /** 读取当前授权账户与链，不弹窗 */
  const sync = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth || disconnected.current) return;
    const requestRevision = revision.current;
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as Address[];
      const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
      if (!mounted.current || disconnected.current || requestRevision !== revision.current) return;
      setAddress(accounts[0]);
      setWalletChainId(Number(BigInt(chainHex)));
      setStatus(accounts[0] ? "connected" : "idle");
    } catch {
      // 静默失败：未授权不是错误，用户还没点连接而已
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void sync();

    const eth = window.ethereum;
    if (!eth?.on) return () => {
      mounted.current = false;
      revision.current += 1;
    };

    const onAccounts = (accounts: unknown) => {
      if (disconnected.current) return;
      const list = accounts as Address[];
      setAddress(list[0]);
      setStatus(list[0] ? "connected" : "idle");
    };
    const onChain = (id: unknown) => {
      if (!disconnected.current) setWalletChainId(Number(BigInt(id as string)));
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      mounted.current = false;
      revision.current += 1;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, [sync]);

  const connect = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) {
      setError(t("wallet.noProvider"));
      return;
    }
    const requestRevision = ++revision.current;
    setStatus("connecting");
    setError(undefined);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
      const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
      if (!mounted.current || requestRevision !== revision.current) return;
      disconnected.current = false;
      rememberDisconnected(false);
      setAddress(accounts[0]);
      setWalletChainId(Number(BigInt(chainHex)));
      setStatus(accounts[0] ? "connected" : "idle");
    } catch (e) {
      if (!mounted.current || requestRevision !== revision.current) return;
      setStatus("idle");
      setError(e instanceof Error ? e.message : t("wallet.connectFailed"));
    }
  }, [t]);

  /**
   * 退出当前网站会话，立即清空展示与签名入口，不依赖钱包提供额外的撤权接口。
   * 注入式钱包的账户权限由钱包管理；用独立标记防止刷新或账户事件把连接自动恢复。
   * 再次点击连接成功后才清除此标记，因此取消连接弹窗不会丢掉之前的退出选择。
   */
  const disconnect = useCallback(() => {
    disconnected.current = true;
    revision.current += 1;
    rememberDisconnected(true);
    setAddress(undefined);
    setWalletChainId(undefined);
    setStatus("idle");
    setError(undefined);
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth || disconnected.current) return;
    const requestRevision = revision.current;
    const chainIdHex = `0x${CHAIN_ID.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (e) {
      if (!mounted.current || disconnected.current || requestRevision !== revision.current) return;
      // 4902 = 钱包里还没有这条链，补一次 addEthereumChain
      const code = (e as { code?: number }).code;
      if (code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrls.default.http[0]],
                blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
              },
            ],
          });
        } catch (addError) {
          if (!mounted.current || disconnected.current || requestRevision !== revision.current) return;
          setError(addError instanceof Error ? addError.message : t("wallet.addChainFailed"));
        }
      } else {
        setError(e instanceof Error ? e.message : t("wallet.switchFailed"));
      }
    }
    void sync();
  }, [sync, t]);

  const sendSubmit = useCallback(
    async (level: bigint, moves: Hex) => {
      const eth = window.ethereum;
      if (!eth) throw new Error(t("wallet.noProviderShort"));
      if (disconnected.current || !address) throw new Error(t("wallet.notConnected"));
      if (walletChainId !== CHAIN_ID) throw new Error(t("wallet.wrongNetwork"));

      const walletClient = createWalletClient({ chain, transport: custom(eth) });
      return walletClient.writeContract({
        address: PUZZLE_ADDRESS,
        abi: puzzleAbi,
        functionName: "submit",
        args: [level, moves],
        account: address,
        chain,
      });
    },
    [address, walletChainId, t],
  );

  return {
    address,
    walletChainId,
    status,
    error,
    wrongChain: status === "connected" && walletChainId !== CHAIN_ID,
    hasProvider,
    connect,
    disconnect,
    switchChain,
    sendSubmit,
  };
}
