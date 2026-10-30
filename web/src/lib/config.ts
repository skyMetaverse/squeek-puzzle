// 文件作用：运行时配置（链、合约地址、RPC、区块浏览器）。
//
// 只支持 Sepolia 正式部署，链是写死的常量。本地 anvil 那条链路已经从代码里移除，
// 想换 RPC 或换合约地址用环境变量覆盖即可（Vercel 项目环境变量 / 本地 .env.local）。
import { type Address } from "viem";
import { sepolia } from "viem/chains";

/** 唯一支持的链：Sepolia */
export const CHAIN_ID = sepolia.id;
export const chain = sepolia;

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

/** SqueekPuzzle 部署记录：区块 12025550 */
const DEFAULT_PUZZLE = "0x49d0227b7e6d94a3c2c321b1c5770ab39149c391";
const DEFAULT_CORE = "0x74665daeca35a2303e767e76a2ff1fb6f93e119f";
const DEFAULT_DEPLOY_BLOCK = 12025550n;

export const PUZZLE_ADDRESS = normalize(import.meta.env.VITE_PUZZLE_ADDRESS ?? DEFAULT_PUZZLE);
export const CORE_ADDRESS = normalize(import.meta.env.VITE_CORE_ADDRESS ?? DEFAULT_CORE);

/** 合约部署区块，用作日志回溯下界 */
export const DEPLOY_BLOCK = parseBlock(import.meta.env.VITE_DEPLOY_BLOCK, DEFAULT_DEPLOY_BLOCK);

export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

/** 区块浏览器 */
export const EXPLORER_URL = "https://sepolia.etherscan.io";
