// 文件作用：前端用到的合约 ABI。
// 只声明游戏实际调用的方法，字段顺序必须与 Solidity 里的 struct 完全一致，
// 否则 viem 解码出来的值会错位。
import { parseAbi } from "viem";

export const puzzleAbi = parseAbi([
  "function board() view returns ((uint256 index, uint64 certifiedRound, uint64 startRound, uint64 endRound, bytes32 seed, uint64 walls, uint64 boxes, uint64 targets, uint8 player, uint256 solved))",
  "function currentLevelIndex() view returns (uint256)",
  "function levelAt(uint256 index) view returns ((uint256 index, bytes32 seed, uint64 walls, uint64 boxes, uint64 targets, uint8 player))",
  "function bestMoves(uint256 index, address player) view returns (uint256)",
  "function solvedCount(uint256 index) view returns (uint256)",
  "function submit(uint256 index, bytes moves)",
  "event Solved(uint256 indexed level, address indexed player, uint256 moves, uint256 at)",
]);

// SqueekCore 只读接口：configuration() 用来算轮次时长，state() 用来显示已认证前沿。
// 字段顺序取自官方文档的 tuple 定义。
export const coreAbi = parseAbi([
  "function configuration() view returns (bytes32 streamId, uint64 genesisTimestamp, uint64 roundDuration, uint64 maxWorkPerRound, uint16 maxRoundsPerBatch, address guardian, address reporter, uint32 initialWorkPerThousandBlocks, uint64 targetBlocksPerActiveRound, uint64 difficultySmoothingRounds, uint96 blockUnitsPerBlock)",
  "function state() view returns (uint64 settledThroughRound, uint64 cumulativeWork, uint96 cumulativeBlockUnits, uint64 blockHeight, uint96 blockProgress, uint32 workPerThousandBlocks, uint256 authorizationNonce, bool paused)",
]);
