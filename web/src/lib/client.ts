// 文件作用：只读链客户端。所有链上读取都走这个实例，保证用的是同一套链配置。
import { createPublicClient, http } from "viem";
import { chain, RPC_URL } from "./config";

export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL, { timeout: 20_000, retryCount: 2 }),
});
