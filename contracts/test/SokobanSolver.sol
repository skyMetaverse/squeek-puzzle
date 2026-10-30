// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title SokobanSolver
/// @notice 测试专用的 6x6 推箱子 BFS 求解器。
///
/// 文件作用：
///   用来在单元测试里独立证明"合约生成的关卡真的可解"，而不是只依赖
///   "反向构造所以一定可解"这个口头论证。
///
/// 核心功能：
///   - 把 (仓鼠位置, 三颗坚果位置) 打包成 uint32 作为 BFS 状态；
///   - 广度优先搜索，第一次到达"三颗坚果都在窝上"即为最短解；
///   - 沿 parent 指针回溯出完整移动序列。
///
/// 主要流程：
///   solve() -> BFS -> 回溯路径 -> 返回 (是否可解, 方向字节串)
///
/// 说明：方向编码与合约一致：0=上 1=右 2=下 3=左。移动规则必须与合约 `_apply`
///       完全一致，否则解出来的路径提交会被拒 —— 这个一致性本身也是被测对象。
contract SokobanSolver {
    uint256 private constant SIZE = 6;
    uint256 private constant CELLS = 36;

    /// @dev 用 epoch 代替清空 visited，避免每次求解都要重置大数组
    uint256 public epoch;
    mapping(uint32 => uint256) private seenEpoch;
    mapping(uint32 => uint32) private parent;
    mapping(uint32 => uint8) private moveOf;

    /// @notice 求解。返回是否可解以及最短解的方向字节串。
    function solve(uint64 walls, uint64 boxes, uint64 targets, uint8 player)
        external
        returns (bool solved, bytes memory moves)
    {
        epoch += 1;

        uint32 start = _pack(player, boxes);
        uint32[] memory queue = new uint32[](20000);
        queue[0] = start;
        seenEpoch[start] = epoch;
        parent[start] = start;

        uint256 head;
        uint256 tail = 1;
        while (head < tail) {
            uint32 current = queue[head++];
            if (_boxesOf(current) == targets) return (true, _path(current, start));
            for (uint8 dir = 0; dir < 4; dir++) {
                uint32 next = _neighbor(current, walls, dir);
                if (next == type(uint32).max) continue;
                if (seenEpoch[next] == epoch) continue;
                seenEpoch[next] = epoch;
                parent[next] = current;
                moveOf[next] = dir;
                queue[tail++] = next;
            }
        }
        return (false, "");
    }

    /// @dev 计算一步之后的局面；非法返回 type(uint32).max 作为哨兵。
    ///      规则与 SqueekPuzzle._apply 完全一致。
    function _neighbor(uint32 state, uint64 walls, uint8 dir) private pure returns (uint32) {
        uint256 pos = uint256(state & 0x3f);
        uint64 boxes = _boxesOf(state);
        int256 delta = _delta(dir);

        int256 nextI = int256(pos) + delta;
        if (nextI < 0 || nextI >= int256(CELLS)) return type(uint32).max;
        uint256 next = uint256(nextI);
        if ((walls >> next) & 1 == 1) return type(uint32).max;

        uint64 nextBoxes = boxes;
        if ((boxes >> next) & 1 == 1) {
            int256 beyondI = nextI + delta;
            if (beyondI < 0 || beyondI >= int256(CELLS)) return type(uint32).max;
            uint256 beyond = uint256(beyondI);
            if ((walls >> beyond) & 1 == 1) return type(uint32).max;
            if ((boxes >> beyond) & 1 == 1) return type(uint32).max;
            nextBoxes = (boxes & ~(uint64(1) << next)) | (uint64(1) << beyond);
        }
        return _pack(uint8(next), nextBoxes);
    }

    function _delta(uint8 dir) private pure returns (int256) {
        if (dir == 0) return -int256(SIZE);
        if (dir == 1) return 1;
        if (dir == 2) return int256(SIZE);
        return -1;
    }

    /// @dev 状态打包：低 6 位是仓鼠，往上每 6 位一颗坚果（升序排列，保证同一局面只有一个编码）
    function _pack(uint8 player, uint64 boxes) private pure returns (uint32 packed) {
        uint256[3] memory cells;
        uint256 count;
        for (uint256 i = 0; i < CELLS; i++) {
            if ((boxes >> i) & 1 == 1) {
                cells[count] = i;
                unchecked {
                    count++;
                }
            }
        }
        packed = uint32(player) | (uint32(cells[0]) << 6) | (uint32(cells[1]) << 12)
            | (uint32(cells[2]) << 18);
    }

    /// @dev 从打包状态里还原坚果位图
    function _boxesOf(uint32 packed) private pure returns (uint64) {
        return (uint64(1) << uint256((packed >> 6) & 0x3f)) | (uint64(1) << uint256((packed >> 12) & 0x3f))
            | (uint64(1) << uint256((packed >> 18) & 0x3f));
    }

    /// @dev 从终点沿 parent 回溯，反向拼出移动序列
    function _path(uint32 goal, uint32 start) private view returns (bytes memory moves) {
        uint256 length;
        uint32 cursor = goal;
        while (cursor != start) {
            unchecked {
                length++;
            }
            cursor = parent[cursor];
        }
        moves = new bytes(length);
        cursor = goal;
        for (uint256 i = length; i > 0; i--) {
            moves[i - 1] = bytes1(moveOf[cursor]);
            cursor = parent[cursor];
        }
    }
}
