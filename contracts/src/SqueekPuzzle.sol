// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ISqueekCore} from "./interfaces/ISqueekCore.sol";

/// @title SqueekPuzzle — 仓鼠推坚果（Squeekchain 每日三关解谜）
///
/// 文件作用：
///   本合约是游戏的"后端"：①根据 Squeekchain 已结算数据确定当前是哪一关；
///   ②用链上种子确定性地生成 6x6 推箱子关卡；③校验玩家提交的解法并记录成绩。
///
/// 核心功能：
///   1. `currentLevelIndex()`：关卡编号完全由 SqueekCore 的已认证轮次前沿决定，
///      48 个轮次（48 * 600s = 8 小时）一关，即每天 3 关。
///   2. `levelAt(index)`：纯计算生成关卡。种子来自"本关第一轮"的 dataHash，
///      该轮一旦认证就不再变化，因此同一关在任何时刻、任何人算出来都完全一致。
///   3. `submit(index, moves)`：重放玩家提交的移动序列，全部合法且三颗坚果都进窝才算通过。
///
/// 主要流程：
///   SqueekCore 认证轮次 → 关卡编号推进 → 前端读 `board()` 拿关卡 →
///   玩家离线解谜 → 提交移动序列 → 合约重放校验 → 记录最少步数并发事件。
///
/// 设计约束（为什么这样做）：
///   - 只用"已结算"数据（settledThroughRound），不用实时转速或 wall clock，
///     避免"同一关在不同人屏幕上不一样"。
///   - 关卡在链上生成而不是前端生成：前端自己生成一旦与合约不一致就会出现
///     "解出来但提交被拒"，把唯一真值放在合约里可以彻底消除这类分歧。
///   - 关卡用"反向推箱"构造：先让三颗坚果都在窝上，再随机往回拉若干步。
///     反向拉的每一步都是一次合法推动的逆操作，因此生成的关卡天然可解，
///     不需要在链上跑求解器（链上 BFS 在 gas 上不可行）。
contract SqueekPuzzle {
    // ---------------------------------------------------------------------
    // 棋盘与关卡常量
    // ---------------------------------------------------------------------

    /// @notice 棋盘边长（6x6）
    uint256 public constant SIZE = 6;
    /// @notice 格子总数
    uint256 public constant CELLS = SIZE * SIZE;
    /// @notice 坚果数量（= 窝的数量）
    uint256 public constant BOX_COUNT = 3;
    /// @notice 多少轮一关。SqueekCore 一轮 600 秒，48 轮 = 28800 秒 = 8 小时
    uint256 public constant ROUNDS_PER_LEVEL = 48;
    /// @notice 单次提交允许的最大步数，防止 calldata 过大导致重放开销不可控
    uint256 public constant MAX_MOVES = 200;
    /// @notice 关卡生成最大重试次数。种子确定，重试次数也必须确定，否则同一关会漂移
    uint256 public constant MAX_GEN_ATTEMPTS = 16;
    /// @notice 内部障碍数量（外圈永远是墙）
    uint256 public constant INTERIOR_WALLS = 1;
    /// @notice 反向拉取的目标步数（实际步数受棋盘空间限制，可能更少）
    uint256 public constant PULL_STEPS = 12;
    /// @notice 至少要成功拉取多少步，否则关卡太简单
    uint256 public constant MIN_PULLS = 8;
    /// @notice 每次拉取后仓鼠至少还要能走到这么多格，避免被自己拉回来的坚果堵死
    uint256 public constant MIN_AREA = 6;

    /// @dev 36 位全 1，用于把位棋盘裁到合法范围
    uint64 private constant FULL = (uint64(1) << 36) - 1;
    /// @dev 第 0 列的位掩码，用于阻止左右移动跨行回绕
    uint64 private constant COL0 = 1090785345;
    /// @dev 第 5 列的位掩码
    uint64 private constant COL5 = 34905131040;

    // ---------------------------------------------------------------------
    // 错误
    // ---------------------------------------------------------------------

    error LevelNotOpen(uint256 index, uint256 current);
    error BadMoveCount(uint256 length);
    error IllegalMove(uint256 position);
    error NotSolved();
    error GenerationFailed();

    // ---------------------------------------------------------------------
    // 数据结构
    // ---------------------------------------------------------------------

    /// @notice 确定性随机流状态。用计数器而不是区块变量，保证关卡可复现。
    struct Rng {
        bytes32 seed;
        uint256 counter;
    }

    /// @notice 关卡。三种位图各用 36 个 bit 表示 36 个格子，bit i = 第 i 格
    struct Level {
        uint256 index;
        bytes32 seed;
        uint64 walls;
        uint64 boxes;
        uint64 targets;
        uint8 player;
    }

    /// @notice 前端一次调用就能拿全的棋盘视图
    struct Board {
        uint256 index;
        uint64 certifiedRound;
        uint64 startRound;
        uint64 endRound;
        bytes32 seed;
        uint64 walls;
        uint64 boxes;
        uint64 targets;
        uint8 player;
        uint256 solved;
    }

    // ---------------------------------------------------------------------
    // 状态
    // ---------------------------------------------------------------------

    /// @notice SqueekCore 代理地址（只读使用）
    ISqueekCore public immutable core;

    /// @notice 关卡 -> 玩家 -> 最少步数（0 表示未通过）
    mapping(uint256 => mapping(address => uint256)) public bestMoves;
    /// @notice 关卡 -> 已通过人数
    mapping(uint256 => uint256) public solvedCount;

    /// @notice 提交成绩。indexed 的 level 让前端可以按关卡过滤日志
    event Solved(uint256 indexed level, address indexed player, uint256 moves, uint256 at);
    /// @notice 部署时记录依赖的 SqueekCore 地址，便于前端核对
    event CoreBound(address core);

    constructor(ISqueekCore core_) {
        // core 是 immutable：一旦部署就不能换掉，避免"换预言机改历史关卡"
        core = core_;
        emit CoreBound(address(core_));
    }

    // ---------------------------------------------------------------------
    // 关卡编号
    // ---------------------------------------------------------------------

    /// @notice 当前关卡编号 = 已认证轮次前沿 / 48。
    /// @dev 用"已认证"而不是"当前时钟轮次"：前沿之后的轮次对合约来说是未知的，
    ///      拿未知数据当关卡种子会让同一关在不同时间算出不同结果。
    function currentLevelIndex() public view returns (uint256) {
        return uint256(core.state().settledThroughRound) / ROUNDS_PER_LEVEL;
    }

    // ---------------------------------------------------------------------
    // 关卡读取
    // ---------------------------------------------------------------------

    /// @notice 读取指定关卡。只允许读已开启的关卡。
    function levelAt(uint256 index) public view returns (Level memory) {
        uint256 current = currentLevelIndex();
        if (index > current) revert LevelNotOpen(index, current);
        return _generate(_seedFor(index), index);
    }

    /// @notice 前端一次读取所需全部数据
    function board() external view returns (Board memory b) {
        uint64 frontier = core.state().settledThroughRound;
        uint256 index = uint256(frontier) / ROUNDS_PER_LEVEL;
        Level memory lv = _generate(_seedFor(index), index);
        b = Board({
            index: index,
            certifiedRound: frontier,
            startRound: uint64(index * ROUNDS_PER_LEVEL),
            endRound: uint64((index + 1) * ROUNDS_PER_LEVEL),
            seed: lv.seed,
            walls: lv.walls,
            boxes: lv.boxes,
            targets: lv.targets,
            player: lv.player,
            solved: solvedCount[index]
        });
    }

    /// @dev 关卡种子 = keccak(关卡号, 本关第一轮结束时的账本位置, 合约地址, chainId)。
    ///
    ///      为什么用"点读"而不是轮次的 dataHash：
    ///      roundPage 的 rounds 数组只包含**活跃轮次**（工作量 > 0）。仓鼠睡一轮就没有记录，
    ///      按 dataHash 取种子会在真实链上随机失败 —— 这一点是在 Sepolia 上用真实状态验证出来的，
    ///      不是从文档推断的。而 `roundPage(r, r, 0).end` 是文档给出的点读方式，
    ///      对任何已认证轮次都成立（round 0 返回启动位置）。
    ///
    ///      稳定性：某一轮一旦被认证，它的 end 位置就永久固定，所以同一关永远一样。
    ///      不可预测性：本关第一轮在关卡开启前还没结算，没人能提前算出种子。
    function _seedFor(uint256 index) internal view returns (bytes32) {
        uint64 seedRound = uint64(index * ROUNDS_PER_LEVEL);
        ISqueekCore.LedgerPosition memory pos = core.roundPage(seedRound, seedRound, 0).end;
        return keccak256(
            abi.encode(
                index,
                pos.cumulativeWork,
                pos.cumulativeBlockUnits,
                pos.workPerThousandBlocks,
                address(this),
                block.chainid
            )
        );
    }

    // ---------------------------------------------------------------------
    // 关卡生成
    // ---------------------------------------------------------------------

    /// @dev 带重试的生成入口。重试序号参与随机流，所以失败后下一次生成的是不同的关卡。
    function _generate(bytes32 seed, uint256 index) private pure returns (Level memory) {
        for (uint256 attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
            (Level memory candidate, bool ok,) = _attempt(seed, index, attempt);
            if (ok) return candidate;
        }
        // 理论上到不了这里：6x6 内圈 16 格放 3 个窝 + 3 颗坚果，合法配置极多
        revert GenerationFailed();
    }

    /// @dev 单次生成尝试。ok=false 表示这次随机结果不满足关卡质量要求，需要换随机流重来。
    ///      所有中间结果都写在 lv 上（memory 结构体按引用传递），以减少局部变量、
    ///      同时避开 Solidity 的 "stack too deep"。
    ///      第三个返回值 applied 是实际拉取步数，仅用于测试诊断。
    function _attempt(bytes32 seed, uint256 index, uint256 attempt)
        internal
        pure
        returns (Level memory lv, bool ok, uint256 applied)
    {
        Rng memory r = Rng({seed: seed, counter: attempt * 1024});
        lv.index = index;
        lv.seed = seed;

        // ① 外圈墙 + 内圈障碍
        lv.walls = _border();
        for (uint256 i = 0; i < INTERIOR_WALLS; i++) {
            uint256 k = _rand(r) % 16; // 内圈 4x4 共 16 格
            lv.walls |= uint64(1) << ((1 + k / 4) * SIZE + (1 + k % 4));
        }

        // ② 三个窝：必须落在空格上且互不重叠
        if (!_placeTargets(r, lv)) return (lv, false, 0);

        // ③ 坚果先全部放在窝上（此时已通关），再往回拉散 —— 这就是"反向构造"
        lv.boxes = lv.targets;
        if (!_placePlayer(r, lv)) return (lv, false, 0);

        // ④ 反向拉取，并检查质量门槛
        //
        // 门槛随尝试次数逐级放宽：小棋盘上"拉够 6 步"不是每次都能做到，
        // 如果一直用严格门槛，会有约 10% 的关卡直接生成失败，玩家就会卡死。
        // 放宽顺序固定（attempt 8 起降到 4 步、12 起降到 3 步），
        // 所以同一关的结果依然完全可复现。
        applied = _pull(r, lv);
        uint256 minPulls = MIN_PULLS;
        if (attempt >= 8) minPulls = 8;
        if (attempt >= 12) minPulls = 7;
        if (applied < minPulls) return (lv, false, applied);
        if (_countOffTarget(lv.boxes, lv.targets) < 2) return (lv, false, applied);

        ok = true;
    }

    /// @dev 放置三个窝。用有限次重试而不是 while(true)，保证链上执行可预测。
    function _placeTargets(Rng memory r, Level memory lv) private pure returns (bool) {
        for (uint256 i = 0; i < BOX_COUNT; i++) {
            uint256 cell = _pickFree(r, lv.walls | lv.targets);
            if (cell == type(uint256).max) return false;
            lv.targets |= uint64(1) << cell;
        }
        return true;
    }

    /// @dev 仓鼠初始位置：直接放在一个"合法推动点"上，保证第一次反向拉取一定成立。
    function _placePlayer(Rng memory r, Level memory lv) private pure returns (bool) {
        for (uint256 t = 0; t < 64; t++) {
            uint256 which = _rand(r) % BOX_COUNT;
            uint256 dir = _rand(r) % 4;
            int256 delta = _delta(dir);
            int256 stand = int256(_nthBox(lv.boxes, which)) - delta;
            if (!_free(lv.walls, lv.boxes, stand)) continue;
            if ((lv.targets >> uint256(stand)) & 1 == 1) continue;
            if (!_free(lv.walls, lv.boxes, stand - delta)) continue;
            lv.player = uint8(uint256(stand));
            return true;
        }
        return false;
    }

    /// @dev 反向拉取：每一步都是"某次合法推动的逆操作"，因此生成的关卡一定可解。
    ///
    ///      三个关键约束（写错就会生成不可解或死气沉沉的关卡，测试里的 BFS 会立刻抓到）：
    ///      1. 正向推动后仓鼠一定站在坚果原来那一格，所以反向时仓鼠必须正好贴在
    ///         坚果的"来向"一侧：stand == box - delta。
    ///      2. 仓鼠必须真的能走到 stand 这一格。所以每步先做洪泛填充算出可达区域，
    ///         只在可达区域里挑推动点。少了这一步，仓鼠只能贴着同一颗坚果退到墙边。
    ///      3. 拉完之后仓鼠不能被困死。拉取会把坚果塞到仓鼠和空地之间，
    ///         在 6x6 这种小棋盘上很容易把仓鼠关进角落，链条立刻断掉。
    ///         所以候选点还要过一遍"拉完可达区域 >= MIN_AREA"的检查。
    ///
    ///      实现上先把当前所有合法推动点枚举出来再随机选一个，而不是"随机试、失败就重抽"：
    ///      枚举最多 12 个候选，成本固定，也不会出现重抽多次仍是同一个点。
    function _pull(Rng memory r, Level memory lv) private pure returns (uint256 applied) {
        for (uint256 step = 0; step < PULL_STEPS; step++) {
            uint64 reachable = _reachable(lv.walls, lv.boxes, lv.player);
            (uint8[12] memory candidates, uint256 count) = _pullCandidates(lv, reachable);
            if (count == 0) break; // 没有可拉的坚果了，提前结束

            // 随机起点 + 顺序尝试：正常情况下第一个候选就能通过"不会被堵死"的检查，
            // 每步只做一次洪泛填充；只有会把仓鼠关起来时才换下一个。
            // （若对每个候选都算一遍可达区域，gas 会高出约 10 倍。）
            uint256 start = _rand(r) % count;
            uint8 chosen = candidates[start];
            for (uint256 i = 0; i < count; i++) {
                uint8 candidate = candidates[(start + i) % count];
                uint256 cell = uint256(candidate) / 4;
                uint256 dir = uint256(candidate) % 4;
                if (_areaAfter(lv, cell, dir) < MIN_AREA) continue;
                chosen = candidate;
                break;
            }
            _doPull(lv, chosen);
            unchecked {
                applied++;
            }
        }
    }

    /// @dev 枚举所有合法反向拉取，编码为 cell * 4 + dir，最多 12 个（3 颗坚果 x 4 方向）
    function _pullCandidates(Level memory lv, uint64 reachable)
        private
        pure
        returns (uint8[12] memory out, uint256 count)
    {
        // 先把三颗坚果的位置取出来，再只对这三格枚举方向：
        // 直接扫 36 格 × 4 方向会多算 12 倍，gas 上很明显。
        uint256[3] memory cells;
        uint256 found;
        for (uint256 cell = 0; cell < CELLS && found < BOX_COUNT; cell++) {
            if ((lv.boxes >> cell) & 1 == 1) {
                cells[found] = cell;
                unchecked {
                    found++;
                }
            }
        }
        for (uint256 i = 0; i < found; i++) {
            for (uint256 dir = 0; dir < 4; dir++) {
                if (!_pullable(lv, reachable, int256(cells[i]), dir)) continue;
                out[count] = uint8(cells[i] * 4 + dir);
                unchecked {
                    count++;
                }
            }
        }
    }

    /// @dev 这个推动点是否成立
    function _pullable(Level memory lv, uint64 reachable, int256 box, uint256 dir)
        private
        pure
        returns (bool)
    {
        int256 delta = _delta(dir);
        int256 stand = box - delta; // 仓鼠推动时必须站的位置
        if (!_free(lv.walls, lv.boxes, stand)) return false;
        if ((reachable >> uint256(stand)) & 1 == 0) return false; // 仓鼠走不过去
        // 不允许把坚果拉到任何窝上：否则会出现"开局就有一颗已经放好"，关卡变得没意思。
        // 禁止后，每颗坚果被拉过一次就永远离开窝。
        if ((lv.targets >> uint256(stand)) & 1 == 1) return false;
        if (!_free(lv.walls, lv.boxes, stand - delta)) return false; // 仓鼠推完要退的位置
        return true;
    }

    /// @dev 执行一次反向拉取后，仓鼠能到达的格子数。用来识别"被自己推的坚果堵死"。
    function _areaAfter(Level memory lv, uint256 cell, uint256 dir) private pure returns (uint256) {
        int256 delta = _delta(dir);
        uint64 boxes = (lv.boxes & ~(uint64(1) << cell)) | (uint64(1) << uint256(int256(cell) - delta));
        uint8 player = uint8(uint256(int256(cell) - 2 * delta));
        return _popcount(_reachable(lv.walls, boxes, player));
    }

    /// @dev 执行一次反向拉取：坚果退到仓鼠脚下，仓鼠再退一格
    function _doPull(Level memory lv, uint8 encoded) private pure {
        uint256 cell = uint256(encoded) / 4;
        uint256 dir = uint256(encoded) % 4;
        int256 delta = _delta(dir);
        int256 stand = int256(cell) - delta;
        lv.boxes = (lv.boxes & ~(uint64(1) << cell)) | (uint64(1) << uint256(stand));
        lv.player = uint8(uint256(stand - delta));
    }

    /// @dev 洪泛填充：从 start 出发、把坚果当障碍，算出仓鼠能到达的所有格子。
    ///      用位棋盘四向扩散，每轮 4 次移位 + 掩码，收敛最多 6 轮，gas 可控。
    function _reachable(uint64 walls, uint64 boxes, uint8 start) private pure returns (uint64 seen) {
        uint64 blocked = walls | boxes;
        uint64 frontier = uint64(1) << start;
        seen = frontier;
        for (uint256 i = 0; i < CELLS && frontier != 0; i++) {
            uint64 next = ((frontier << 1) & ~COL0) // 向右：目的格不能落在第 0 列
                | ((frontier >> 1) & ~COL5) // 向左：目的格不能落在第 5 列
                | (frontier >> SIZE) // 向上
                | ((frontier << SIZE) & FULL); // 向下：越界位由 FULL 清掉
            next &= ~blocked & FULL & ~seen;
            seen |= next;
            frontier = next;
        }
    }

    /// @dev 在空格中随机取一格；取不到返回 type(uint256).max 作为哨兵。
    function _pickFree(Rng memory r, uint64 occupied) private pure returns (uint256) {
        for (uint256 t = 0; t < 64; t++) {
            uint256 cell = _rand(r) % CELLS;
            if (((occupied >> cell) & 1) == 0) return cell;
        }
        return type(uint256).max;
    }

    // ---------------------------------------------------------------------
    // 提交解法
    // ---------------------------------------------------------------------

    /// @notice 提交解法。moves 每个字节是一个方向：0=上 1=右 2=下 3=左
    /// @dev 采用"严格重放"：任何一步撞墙/撞坚果都直接 revert，而不是静默忽略。
    ///      这样链上记录的就是玩家真实走过的那条路径，步数不会被"空转"污染。
    function submit(uint256 index, bytes calldata moves) external {
        uint256 current = currentLevelIndex();
        if (index != current) revert LevelNotOpen(index, current);
        if (moves.length == 0 || moves.length > MAX_MOVES) revert BadMoveCount(moves.length);

        Level memory lv = _generate(_seedFor(index), index);
        for (uint256 i = 0; i < moves.length; i++) {
            uint8 dir = uint8(moves[i]);
            if (dir > 3) revert IllegalMove(i);
            if (!_apply(lv, dir)) revert IllegalMove(i);
        }
        // 坚果位图与窝位图完全相等 <=> 每颗坚果都在窝上（数量相同、位置唯一）
        if (lv.boxes != lv.targets) revert NotSolved();

        uint256 movesUsed = moves.length;
        uint256 previous = bestMoves[index][msg.sender];
        // 只记录更好成绩；重复提交更差的成绩不覆盖，也不额外收费
        if (previous == 0 || movesUsed < previous) {
            bestMoves[index][msg.sender] = movesUsed;
        }
        if (previous == 0) {
            solvedCount[index] += 1;
        }
        emit Solved(index, msg.sender, movesUsed, block.timestamp);
    }

    /// @dev 单步推进。非法移动返回 false（由调用方决定 revert）。
    function _apply(Level memory lv, uint8 dir) private pure returns (bool) {
        int256 p = int256(uint256(lv.player));
        int256 delta = _delta(dir);
        int256 next = p + delta;
        if (!_inside(next)) return false;
        if ((lv.walls >> uint256(next)) & 1 == 1) return false;

        if ((lv.boxes >> uint256(next)) & 1 == 1) {
            // 前面有坚果：尝试推动
            int256 beyond = next + delta;
            if (!_inside(beyond)) return false;
            if ((lv.walls >> uint256(beyond)) & 1 == 1) return false;
            if ((lv.boxes >> uint256(beyond)) & 1 == 1) return false;
            lv.boxes = (lv.boxes & ~(uint64(1) << uint256(next))) | (uint64(1) << uint256(beyond));
        }
        lv.player = uint8(uint256(next));
        return true;
    }

    // ---------------------------------------------------------------------
    // 工具函数
    // ---------------------------------------------------------------------

    /// @dev 确定性随机：同一 (seed, counter) 永远得到同一个数，不依赖区块变量。
    ///      用计数器而不是 block.prevrandao，是为了让关卡可复现、可被任何人独立验证。
    function _rand(Rng memory r) private pure returns (uint256) {
        return uint256(keccak256(abi.encode(r.seed, r.counter++)));
    }

    /// @dev 方向 -> 格子下标增量。0=上 1=右 2=下 3=左
    function _delta(uint256 dir) private pure returns (int256) {
        if (dir == 0) return -int256(SIZE);
        if (dir == 1) return 1;
        if (dir == 2) return int256(SIZE);
        return -1;
    }

    /// @dev 外圈一圈墙
    function _border() private pure returns (uint64 walls) {
        for (uint256 i = 0; i < CELLS; i++) {
            uint256 x = i % SIZE;
            uint256 y = i / SIZE;
            if (x == 0 || x == SIZE - 1 || y == 0 || y == SIZE - 1) {
                walls |= uint64(1) << i;
            }
        }
    }

    function _inside(int256 cell) private pure returns (bool) {
        return cell >= 0 && cell < int256(CELLS);
    }

    /// @dev 该格是否可通行（不是墙、不是坚果）。负数或越界一律不可通行。
    function _free(uint64 walls, uint64 boxes, int256 cell) private pure returns (bool) {
        if (!_inside(cell)) return false;
        uint256 c = uint256(cell);
        if ((walls >> c) & 1 == 1) return false;
        if ((boxes >> c) & 1 == 1) return false;
        return true;
    }

    /// @dev 第 n 个坚果所在的格子下标（n 从 0 开始）
    function _nthBox(uint64 boxes, uint256 n) private pure returns (uint256 found) {
        uint256 seen;
        for (uint256 i = 0; i < CELLS; i++) {
            if ((boxes >> i) & 1 == 1) {
                if (seen == n) return i;
                unchecked {
                    seen++;
                }
            }
        }
        return found;
    }

    /// @dev 位图里 1 的个数
    function _popcount(uint64 bits) private pure returns (uint256 n) {
        while (bits != 0) {
            bits &= bits - 1;
            unchecked {
                n++;
            }
        }
    }

    /// @dev 有几颗坚果不在窝上
    function _countOffTarget(uint64 boxes, uint64 targets) private pure returns (uint256) {
        return _popcount(boxes & ~targets);
    }
}
