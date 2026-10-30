// 文件作用：运行时配置（链、地址、RPC）。
//
// 为什么用环境变量：同一个前端要同时能连本地 anvil 和 Sepolia，
// 地址写死会让本地调试和正式部署互相污染。
// Vercel 上通过项目环境变量注入 VITE_* 即可，无需改代码。
import { defineChain, type Address } from "viem";
import { anvil, sepolia } from "viem/chains";

const rawChainId = import.meta.env.VITE_CHAIN_ID ?? "31337";
export const CHAIN_ID = Number(rawChainId);

/** 本地 anvil 的默认部署地址（DeployLocal.s.sol 的部署顺序固定，地址可复现） */
const LOCAL_PUZZLE = "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9";
const LOCAL_CORE = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

export const IS_LOCAL = CHAIN_ID === 31337;

// 统一转小写：手抄地址时大小写校验（EIP-55）很容易写错，
// 全小写地址 viem 直接接受，不会因为校验位不对而在运行时炸掉。
export const PUZZLE_ADDRESS = (import.meta.env.VITE_PUZZLE_ADDRESS ??
  (IS_LOCAL ? LOCAL_PUZZLE : "0x0000000000000000000000000000000000000000")).toLowerCase() as Address;

export const CORE_ADDRESS = (import.meta.env.VITE_CORE_ADDRESS ??
  (IS_LOCAL ? LOCAL_CORE : "0x74665dAecA35A2303e767E76a2FF1FB6F93e119f")).toLowerCase() as Address;

export const RPC_URL =
  import.meta.env.VITE_RPC_URL ??
  (IS_LOCAL ? "http://127.0.0.1:8545" : "https://ethereum-sepolia-rpc.publicnode.com");

/** 区块浏览器：本地不提供链接 */
export const EXPLORER_URL = IS_LOCAL
  ? null
  : CHAIN_ID === 11155111
    ? "https://eth-sepolia.blockscout.com"
    : null;

/** viem 的链定义。已知链直接复用，其它 chainId 现场构造一个，避免硬编码失败。 */
export const chain =
  CHAIN_ID === sepolia.id
    ? sepolia
    : CHAIN_ID === anvil.id
      ? anvil
      : defineChain({
          id: CHAIN_ID,
          name: `chain-${CHAIN_ID}`,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [RPC_URL] } },
        });

/** 合约部署区块：查日志时的下界，避免从创世块扫。0 表示未知，前端会退化成近 5000 块。 */
export const DEPLOY_BLOCK = import.meta.env.VITE_DEPLOY_BLOCK
  ? BigInt(import.meta.env.VITE_DEPLOY_BLOCK)
  : 0n;

export const APP_NAME = "SQUEK PUZZLE";
