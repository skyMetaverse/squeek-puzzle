// 文件作用：本地链（anvil）端到端验证脚本。
//
// 它做的事：
//   1. 连本地 anvil，读游戏合约的 board()；
//   2. 用一个独立的 BFS 求解器解出最短解（不依赖合约里的生成逻辑）；
//   3. 发一笔真实交易提交解法，确认事件、bestMoves、solvedCount 都对；
//   4. 推进 mock 的已认证轮次前沿，验证"换关"后关卡确实变了并且同样可解。
//
// 用法（先 anvil + forge script 部署，然后）：
//   cd web && bun run e2e
//
// 这个脚本是"合约真的能玩"的证据：求解器是独立实现，所以它同时校验了
// 合约的移动规则、关卡可解性、提交校验和记账逻辑。
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { encodeMoves, solve } from "./solver";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
// anvil 启动时打印的第一个测试账户私钥（公开的、只存在于本地链，绝不能用于真实网络）
// 私钥只从环境变量读，绝不写进仓库。anvil 启动时会打印第一个测试账户的私钥。
const KEY = process.env.E2E_PRIVATE_KEY as Hex | undefined;
if (!KEY) {
  console.error(
    "缺少 E2E_PRIVATE_KEY。\n" +
      "请把它设成 anvil 启动时打印的第一个测试账户私钥，例如：\n" +
      "  E2E_PRIVATE_KEY=0x... bun run e2e",
  );
  process.exit(1);
}

const PUZZLE = (process.env.PUZZLE_ADDRESS ??
  "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9") as Address;
const MOCK = (process.env.CORE_ADDRESS ??
  "0x5fbdb2315678afecb367f032d93f642f64180aa3") as Address;

const puzzleAbi = parseAbi([
  "function board() view returns ((uint256 index, uint64 certifiedRound, uint64 startRound, uint64 endRound, bytes32 seed, uint64 walls, uint64 boxes, uint64 targets, uint8 player, uint256 solved))",
  "function bestMoves(uint256 index, address player) view returns (uint256)",
  "function solvedCount(uint256 index) view returns (uint256)",
  "function submit(uint256 index, bytes moves)",
  "event Solved(uint256 indexed level, address indexed player, uint256 moves, uint256 at)",
]);

const mockAbi = parseAbi([
  "function setFrontier(uint64 next)",
  "function setAutoAdvance(bool on)",
  "function currentFrontier() view returns (uint64)",
]);

const publicClient = createPublicClient({ transport: http(RPC) });
const account = privateKeyToAccount(KEY);
const walletClient = createWalletClient({ account, transport: http(RPC) });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`断言失败：${message}`);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const chainId = await publicClient.getChainId();
  console.log(`chainId = ${chainId}`);

  // 本地 mock 默认按时间自动推进前沿，先关掉，否则断言会因为"测试跑着跑着换关了"而随机失败
  const stop = await walletClient.writeContract({
    address: MOCK,
    abi: mockAbi,
    functionName: "setAutoAdvance",
    args: [false],
  });
  await publicClient.waitForTransactionReceipt({ hash: stop });

  const first = await publicClient.readContract({ address: PUZZLE, abi: puzzleAbi, functionName: "board" });
  console.log(
    `第 ${first.index} 关：前沿 ${first.certifiedRound}，本关 ${first.startRound}→${first.endRound}`,
  );

  const solvedMoves = await playLevel(first.index, "第 1 轮");
  assert(solvedMoves > 0, "应当解出解法");

  // 换关：把 mock 前沿推进 48 轮，关卡编号必须 +1 且关卡内容必须变化
  const frontier = await publicClient.readContract({
    address: MOCK,
    abi: mockAbi,
    functionName: "currentFrontier",
  });
  const next = frontier + 48n;
  const tx = await walletClient.writeContract({
    address: MOCK,
    abi: mockAbi,
    functionName: "setFrontier",
    args: [next],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });

  const second = await publicClient.readContract({ address: PUZZLE, abi: puzzleAbi, functionName: "board" });
  console.log(`推进前沿到 ${next} → 现在是第 ${second.index} 关`);
  assert(second.index === first.index + 1n, "关卡编号应当 +1");
  assert(second.seed !== first.seed, "换关后种子应当变化");

  await playLevel(second.index, "第 2 轮");

  console.log("\n✅ 全部通过：关卡可解、提交被接受、成绩与事件都正确");
}

async function playLevel(index: bigint, label: string): Promise<number> {
  const board = await publicClient.readContract({ address: PUZZLE, abi: puzzleAbi, functionName: "board" });
  assert(board.index === index, `当前关卡应为 ${index}`);

  const moves = solve(board.walls, board.boxes, board.targets, board.player);
  assert(moves && moves.length > 0, "关卡应当可解");
  console.log(`\n[${label}] 第 ${index} 关最短解 ${moves!.length} 步：${encodeMoves(moves!)}`);

  const hash = await walletClient.writeContract({
    address: PUZZLE,
    abi: puzzleAbi,
    functionName: "submit",
    args: [index, encodeMoves(moves!)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  assert(receipt.status === "success", "提交交易应当成功");
  console.log(`[${label}] 提交成功，gasUsed = ${receipt.gasUsed}`);

  const best = await publicClient.readContract({
    address: PUZZLE,
    abi: puzzleAbi,
    functionName: "bestMoves",
    args: [index, account.address],
  });
  assert(best === BigInt(moves!.length), `bestMoves 应为 ${moves!.length}，实际 ${best}`);

  const solvedCount = await publicClient.readContract({
    address: PUZZLE,
    abi: puzzleAbi,
    functionName: "solvedCount",
    args: [index],
  });
  assert(solvedCount === 1n, `solvedCount 应为 1，实际 ${solvedCount}`);

  const logs = await publicClient.getLogs({
    address: PUZZLE,
    fromBlock: receipt.blockNumber,
    toBlock: receipt.blockNumber,
  });
  const events = parseEventLogs({ abi: puzzleAbi, logs, eventName: "Solved" });
  assert(events.length === 1, "应当发出 1 条 Solved 事件");
  const args = events[0].args;
  assert(args.level === index, "事件关卡号应匹配");
  assert(args.player?.toLowerCase() === account.address.toLowerCase(), "事件玩家应匹配");
  assert(args.moves === BigInt(moves!.length), "事件步数应匹配");
  console.log(`[${label}] bestMoves / solvedCount / Solved 事件 全部核对通过`);

  return moves!.length;
}

main().catch((error) => {
  console.error("\n❌", error instanceof Error ? error.message : error);
  process.exit(1);
});
