// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ISqueekCore} from "../interfaces/ISqueekCore.sol";

/// @title MockSqueekCore
/// @notice 本地开发 / 单元测试用的 SqueekCore 替身。
///
/// 文件作用：
///   在没有 Sepolia 历史状态时，让 SqueekPuzzle 仍然能跑完整流程。
///
/// 核心功能：
///   - `setFrontier()`：手动设置"已认证轮次前沿"（单元测试用，结果必须完全可预测）。
///   - `setAutoAdvance()`：本地演示用，让前沿按时间自己往前走，可以看到"换关"。
///   - `roundPage()`：为每个轮次返回确定性的 dataHash（可覆盖），行为对齐真实合约：
///     请求超出前沿的轮次会 revert。
///   - `configuration()`：返回与真实合约同序号的字段，前端可以复用同一套解码逻辑。
///
/// 注意：这是测试替身，绝不能部署到真实网络参与任何资金逻辑。
contract MockSqueekCore is ISqueekCore {
    /// @notice 手动模式下已认证轮次前沿
    uint64 public frontier;
    /// @notice 是否按时间自动推进前沿（仅本地演示用）
    bool public autoAdvance;
    /// @notice 自动推进的起点时间与轮长（秒）
    uint64 public genesis;
    uint64 public roundSeconds;
    /// @notice 显式覆盖某个轮次的 dataHash（测试可用来构造特定种子）
    mapping(uint64 => bytes32) public roundHashOverride;
    /// @notice 是否返回活跃轮次记录。设为 false 用来模拟"这一整段轮次都没有工作量"，
    ///          也就是真实链上 rounds 数组为空的情况 —— 关卡种子绝不能依赖这些记录。
    bool public recordsEnabled = true;

    event FrontierSet(uint64 frontier);

    constructor() {
        roundSeconds = 600;
        genesis = uint64(block.timestamp);
    }

    /// @notice 手动推进已认证轮次前沿
    function setFrontier(uint64 next) external {
        require(next >= frontier, "frontier only moves forward");
        frontier = next;
        emit FrontierSet(next);
    }

    /// @notice 开启按时间自动推进（本地演示用）
    function setAutoAdvance(bool on) external {
        autoAdvance = on;
        genesis = uint64(block.timestamp);
    }

    /// @notice 修改轮长（本地演示想更快看到换关时用）
    function setRoundSeconds(uint64 seconds_) external {
        roundSeconds = seconds_;
    }

    /// @notice 开关活跃轮次记录（模拟零工作量轮次）
    function setRecordsEnabled(bool enabled) external {
        recordsEnabled = enabled;
    }

    /// @notice 覆盖某一轮的 dataHash（用来在测试里固定关卡种子）
    function setRoundHash(uint64 round, bytes32 hash) external {
        roundHashOverride[round] = hash;
    }

    /// @notice 当前有效的已认证轮次前沿
    function currentFrontier() public view returns (uint64) {
        if (!autoAdvance) return frontier;
        return frontier + uint64((block.timestamp - genesis) / roundSeconds);
    }

    function state() external view returns (CoreState memory) {
        uint64 f = currentFrontier();
        return CoreState({
            settledThroughRound: f,
            cumulativeWork: uint64(f) * 137,
            cumulativeBlockUnits: uint96(uint256(f) * 40 * 1e9),
            blockHeight: uint64(uint256(f) * 40),
            blockProgress: 0,
            workPerThousandBlocks: 10875,
            authorizationNonce: 0,
            paused: false
        });
    }

    /// @notice 与真实合约同字段顺序的配置视图，前端可以共用一套解码逻辑
    function configuration() external view returns (CoreConfiguration memory) {
        return CoreConfiguration({
            streamId: keccak256("squeek-puzzle-mock-stream"),
            genesisTimestamp: genesis,
            roundDuration: roundSeconds,
            maxWorkPerRound: 10000,
            maxRoundsPerBatch: 16,
            guardian: address(0),
            reporter: address(0),
            initialWorkPerThousandBlocks: 10875,
            targetBlocksPerActiveRound: 40,
            difficultySmoothingRounds: 30,
            blockUnitsPerBlock: 1e9
        });
    }

    /// @notice 对齐真实合约：点读 roundPage(r, r, 0) 返回第 r 轮结束时的账本位置。
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords)
        external
        view
        returns (RoundPage memory page)
    {
        uint64 f = currentFrontier();
        // 对齐真实合约：超出已认证前沿直接 revert，而不是返回空
        require(throughRound <= f, "round past certified frontier");
        require(throughRound >= afterRound, "reversed range");
        require(maxRecords <= 16, "too many records");

        uint256 count = throughRound > afterRound ? uint256(throughRound - afterRound) : 0;
        if (maxRecords != 0 && count > maxRecords) count = maxRecords;
        if (!recordsEnabled) count = 0;

        RoundRecord[] memory records = new RoundRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            uint64 id = afterRound + uint64(i) + 1;
            records[i] = RoundRecord({
                roundId: id,
                cumulativeWork: _workAt(id),
                cumulativeBlockUnits: _unitsAt(id),
                workPerThousandBlocks: 10875,
                dataHash: _hashOf(id)
            });
        }

        page = RoundPage({
            certifiedThroughRound: throughRound,
            start: _positionAt(afterRound),
            end: _positionAt(throughRound),
            rounds: records
        });
    }

    /// @dev 模拟"每轮都有工作量"的账本位置。真实链上零工作量轮次不会改变位置，
    ///      这里用递增函数只是为了让每关的种子互不相同。
    function _positionAt(uint64 round) private pure returns (LedgerPosition memory) {
        return LedgerPosition({
            cumulativeWork: _workAt(round),
            cumulativeBlockUnits: _unitsAt(round),
            workPerThousandBlocks: 10875
        });
    }

    function _workAt(uint64 round) private pure returns (uint64) {
        return uint64(round) * 137;
    }

    function _unitsAt(uint64 round) private pure returns (uint96) {
        return uint96(uint256(round) * 40 * 1e9);
    }

    /// @dev 轮次 dataHash：有覆盖用覆盖，否则用确定性哈希，保证本地重启后关卡不变
    function _hashOf(uint64 round) private view returns (bytes32) {
        bytes32 overridden = roundHashOverride[round];
        if (overridden != bytes32(0)) return overridden;
        return keccak256(abi.encode("squeek-puzzle-mock-round", round));
    }
}
