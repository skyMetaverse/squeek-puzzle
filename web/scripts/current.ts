// 文件作用：打印当前关卡与参考解（手工验证前端用）。
// 用法：cd web && bun run scripts/current.ts
import { createPublicClient, http, parseAbi } from "viem";
import { encodeMoves, solve } from "./solver";

const puzzleAbi = parseAbi([
  "function board() view returns ((uint256 index, uint64 certifiedRound, uint64 startRound, uint64 endRound, bytes32 seed, uint64 walls, uint64 boxes, uint64 targets, uint8 player, uint256 solved))",
]);

const client = createPublicClient({ transport: http(process.env.RPC_URL ?? "http://127.0.0.1:8545") });
const board = await client.readContract({
  address: (process.env.PUZZLE_ADDRESS ?? "0xdc64a140aa3e981100a9beca4e685f962f0cf6c9") as `0x${string}`,
  abi: puzzleAbi,
  functionName: "board",
});

const moves = solve(board.walls, board.boxes, board.targets, board.player);
console.log(
  JSON.stringify(
    {
      level: board.index.toString(),
      frontier: board.certifiedRound.toString(),
      moves: moves ?? [],
      keys: moves?.map((m) => ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"][m]),
    },
    null,
    2,
  ),
);
