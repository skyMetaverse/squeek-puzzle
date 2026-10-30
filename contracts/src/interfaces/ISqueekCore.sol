// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ISqueekCore
/// @notice Squeekchain SqueekCore（V3 代理）中本游戏用到的只读接口。
///
/// 说明：
/// - 字段顺序严格对应官方 Quickstart 中 `state()` / `roundPage()` 返回的 tuple，
///   顺序错一个字段，viem / Solidity 解出来的值就是错的，所以这里只声明实际用到的字段，
///   并且保持文档给出的顺序。
/// - 本游戏只读这两个函数：`state()` 用来取已认证轮次前沿，`roundPage()` 用来取某一轮的
///   `dataHash` 作为关卡种子。两者都是文档中公开的 view 函数，不涉及签名和资金。
interface ISqueekCore {
    /// @notice 某个轮次结束时的账本位置（roundPage 的 start / end 使用）
    struct LedgerPosition {
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
    }

    /// @notice 单条轮次记录（roundPage 的 rounds 数组元素）。
    /// @dev 注意：rounds 里**只有活跃轮次**（工作量 > 0）。零工作量轮次被隐式认证，
    ///      不会出现在记录里，所以不能假设"某一轮一定有记录"。
    struct RoundRecord {
        uint64 roundId;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint32 workPerThousandBlocks;
        bytes32 dataHash;
    }

    /// @notice roundPage 的整页返回。
    ///
    /// 重要：真实合约是 `returns (RoundPage memory)`，即返回"一个含动态数组的结构体"，
    /// ABI 编码时会在最前面多一个 0x20 的偏移量。如果按平铺 tuple
    /// `returns (uint64, RoundTotals, RoundTotals, RoundRecord[])` 去声明，
    /// 解码会错位并直接 revert —— 这一点是用真实 Sepolia 状态验证出来的，不是文档推断。
    struct RoundPage {
        uint64 certifiedThroughRound;
        LedgerPosition start;
        LedgerPosition end;
        RoundRecord[] rounds;
    }

    /// @notice SqueekCore.state() 的返回结构（顺序与文档一致）
    struct CoreState {
        uint64 settledThroughRound;
        uint64 cumulativeWork;
        uint96 cumulativeBlockUnits;
        uint64 blockHeight;
        uint96 blockProgress;
        uint32 workPerThousandBlocks;
        uint256 authorizationNonce;
        bool paused;
    }

    /// @notice 启动配置（全部是静态字段，ABI 上等价于平铺 tuple）
    struct CoreConfiguration {
        bytes32 streamId;
        uint64 genesisTimestamp;
        uint64 roundDuration;
        uint64 maxWorkPerRound;
        uint16 maxRoundsPerBatch;
        address guardian;
        address reporter;
        uint32 initialWorkPerThousandBlocks;
        uint64 targetBlocksPerActiveRound;
        uint64 difficultySmoothingRounds;
        uint96 blockUnitsPerBlock;
    }

    /// @notice 启动配置与难度规则常量
    function configuration() external view returns (CoreConfiguration memory);

    /// @notice 已结算（已认证）状态。这是唯一可信的"已发生"数据。
    function state() external view returns (CoreState memory);

    /// @notice 分页读取轮次记录。超出已认证前沿会 revert，因此调用方必须自己先确认范围。
    function roundPage(uint64 afterRound, uint64 throughRound, uint256 maxRecords)
        external
        view
        returns (RoundPage memory);
}
