// 文件作用：运行时配置（链、地址、RPC）。
//
// 为什么用环境变量：同一个前端要同时能连本地 anvil 和 Sepolia，
// 地址写死会让本地调试和正式部署互相污染。
// Vercel 上通过项目环境变量注入 VITE_* 即可，无需改代码。
//
// 默认值：指向 Sepolia 的正式部署。本地开发在 web/.env.local 里写
// `VITE_CHAIN_ID=31337` 即可切到 anvil（见 .env.example）。
import { defineChain, type Address } from "viem";
import { anvil, sepolia } from "viem/chains";

/** 一个网络的部署记录 */
interface Deployment {
  puzzle: Address;
  core: Address;
  /** 合约部署区块，用作日志回溯下界；0 表示未知 */
  deployBlock: bigint;
}

/**
 * 已知网络的默认部署记录。
 * - 31337：DeployLocal.s.sol 的产物，部署顺序固定所以地址可复现
 * - 11155111：Sepolia 正式部署（区块 12025550）
 */
const DEPLOYMENTS: Record<number, Deployment> = {
  31337: {
    puzzle: "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9",
    core: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
    deployBlock: 0n,
  },
  11155111: {
    puzzle: "0x49d0227b7e6d94a3c2c321b1c5770ab39149c391",
    core: "0x74665daeca35a2303e767e76a2ff1fb6f93e119f",
    deployBlock: 12025550n,
  },
};

const ZERO: Address = "0x0000000000000000000000000000000000000000";
const UNKNOWN: Deployment = { puzzle: ZERO, core: ZERO, deployBlock: 0n };

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? "11155111");
export const IS_LOCAL = CHAIN_ID === 31337;

const deployment = DEPLOYMENTS[CHAIN_ID] ?? UNKNOWN;

/** 统一转小写：手抄地址时大小写校验（EIP-55）很容易写错，全小写地址 viem 直接接受 */
const normalize = (value: string): Address => value.toLowerCase() as Address;

/** 解析部署区块。填错（非数字）时退回默认值，不让一个环境变量把整页打挂。 */
function parseBlock(value: string | undefined, fallback: bigint): bigint {
  if (!value) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

export const PUZZLE_ADDRESS = normalize(import.meta.env.VITE_PUZZLE_ADDRESS ?? deployment.puzzle);
export const CORE_ADDRESS = normalize(import.meta.env.VITE_CORE_ADDRESS ?? deployment.core);
export const DEPLOY_BLOCK = parseBlock(import.meta.env.VITE_DEPLOY_BLOCK, deployment.deployBlock);

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
