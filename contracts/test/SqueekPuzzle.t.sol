// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SqueekPuzzle} from "../src/SqueekPuzzle.sol";
import {MockSqueekCore} from "../src/mocks/MockSqueekCore.sol";
import {ISqueekCore} from "../src/interfaces/ISqueekCore.sol";
import {SokobanSolver} from "./SokobanSolver.sol";

/// @title SqueekPuzzle 单元测试
///
/// 覆盖范围：
///   1. 关卡编号随 SqueekCore 已认证前沿推进（48 轮一关）
///   2. 关卡生成的确定性、结构合法性（墙/窝/坚果/仓鼠位置）
///   3. 关卡可解性（用独立的 BFS 求解器验证，而不是相信"反向构造"的说法）
///   4. 提交解法的成功路径、最少步数记录、事件
///   5. 各种失败路径：关卡未开启、非法移动、未通关、步数越界
contract SqueekPuzzleTest is Test {
    uint256 private constant SIZE = 6;
    uint256 private constant CELLS = 36;

    MockSqueekCore internal core;
    SqueekPuzzle internal game;
    SokobanSolver internal solver;

    function setUp() public {
        core = new MockSqueekCore();
        // 前沿推到第 10 关结束，测试时当前关卡编号为 10
        core.setFrontier(uint64(48 * 10 + 5));
        game = new SqueekPuzzle(ISqueekCore(address(core)));
        solver = new SokobanSolver();
    }

    // ------------------------------------------------------------------
    // 关卡编号
    // ------------------------------------------------------------------

    function test_LevelIndexFollowsCertifiedFrontier() public {
        uint64[6] memory frontier = [uint64(0), 1, 47, 48, 95, 96];
        uint256[6] memory expected = [uint256(0), 0, 0, 1, 1, 2];
        for (uint256 i = 0; i < frontier.length; i++) {
            MockSqueekCore fresh = new MockSqueekCore();
            fresh.setFrontier(frontier[i]);
            SqueekPuzzle freshGame = new SqueekPuzzle(ISqueekCore(address(fresh)));
            assertEq(freshGame.currentLevelIndex(), expected[i], "level index mismatch");
        }
    }

    function test_RevertWhen_LevelNotOpen() public {
        uint256 current = game.currentLevelIndex();
        vm.expectRevert(abi.encodeWithSelector(SqueekPuzzle.LevelNotOpen.selector, current + 1, current));
        game.levelAt(current + 1);
    }

    // ------------------------------------------------------------------
    // 关卡生成
    // ------------------------------------------------------------------

    function test_LevelIsDeterministic() public view {
        for (uint256 i = 0; i <= game.currentLevelIndex(); i++) {
            SqueekPuzzle.Level memory a = game.levelAt(i);
            SqueekPuzzle.Level memory b = game.levelAt(i);
            assertEq(a.walls, b.walls);
            assertEq(a.boxes, b.boxes);
            assertEq(a.targets, b.targets);
            assertEq(a.player, b.player);
            assertEq(a.seed, b.seed);
        }
    }

    function test_LevelStructureIsValid() public view {
        uint256 last = game.currentLevelIndex();
        for (uint256 i = 0; i <= last; i++) {
            SqueekPuzzle.Level memory lv = game.levelAt(i);
            _assertStructure(lv, i);
        }
    }

    /// @notice 前 8 关必须都能解出来，否则游戏从第一关就是坏的
    function test_LevelsAreSolvable() public {
        for (uint256 i = 0; i <= 8; i++) {
            SqueekPuzzle.Level memory lv = game.levelAt(i);
            (bool solved, bytes memory moves) = solver.solve(lv.walls, lv.boxes, lv.targets, lv.player);
            assertTrue(solved, "level must be solvable");
            assertGt(moves.length, 0, "solution must be non-empty");
        }
    }

    // ------------------------------------------------------------------
    // 提交解法
    // ------------------------------------------------------------------

    function test_SubmitRecordsBestAndEmitsEvent() public {
        uint256 index = game.currentLevelIndex();
        SqueekPuzzle.Level memory lv = game.levelAt(index);
        (bool solved, bytes memory moves) = solver.solve(lv.walls, lv.boxes, lv.targets, lv.player);
        assertTrue(solved);

        vm.expectEmit(true, true, false, true, address(game));
        emit SqueekPuzzle.Solved(index, address(this), moves.length, block.timestamp);
        game.submit(index, moves);

        assertEq(game.bestMoves(index, address(this)), moves.length);
        assertEq(game.solvedCount(index), 1);
    }

    function test_SubmitTwiceKeepsBestAndDoesNotDoubleCount() public {
        uint256 index = game.currentLevelIndex();
        SqueekPuzzle.Level memory lv = game.levelAt(index);
        (bool solved, bytes memory moves) = solver.solve(lv.walls, lv.boxes, lv.targets, lv.player);
        assertTrue(solved);

        game.submit(index, moves);
        game.submit(index, moves);

        assertEq(game.bestMoves(index, address(this)), moves.length);
        assertEq(game.solvedCount(index), 1);
    }

    /// @notice 更长的解法不能覆盖已经记录的最少步数
    function test_LongerSolutionDoesNotOverwriteBest() public {
        uint256 index = game.currentLevelIndex();
        SqueekPuzzle.Level memory lv = game.levelAt(index);
        (bool solved, bytes memory moves) = solver.solve(lv.walls, lv.boxes, lv.targets, lv.player);
        assertTrue(solved);
        game.submit(index, moves);

        // 通关后坚果已在窝上，再让仓鼠多走一步仍然满足"三颗都在窝上"，但步数更长
        (uint256 pos, uint64 boxes,) = _run(lv, moves);
        bytes memory longer = bytes.concat(moves, "");
        for (uint8 dir = 0; dir < 4; dir++) {
            (bool ok, uint256 nextPos, uint64 nextBoxes) = _step(pos, boxes, lv.walls, dir);
            if (!ok) continue;
            longer = bytes.concat(moves, bytes1(dir));
            pos = nextPos;
            boxes = nextBoxes;
            break;
        }
        if (longer.length == moves.length) return; // 通关后无合法走法，跳过该断言

        game.submit(index, longer);
        assertEq(game.bestMoves(index, address(this)), moves.length, "best must not grow");
        assertEq(game.solvedCount(index), 1);
    }

    function test_RevertWhen_WrongLevel() public {
        uint256 index = game.currentLevelIndex();
        vm.expectRevert(abi.encodeWithSelector(SqueekPuzzle.LevelNotOpen.selector, index + 1, index));
        game.submit(index + 1, hex"01");
    }

    function test_RevertWhen_EmptyMoves() public {
        uint256 index = game.currentLevelIndex();
        vm.expectRevert(abi.encodeWithSelector(SqueekPuzzle.BadMoveCount.selector, uint256(0)));
        game.submit(index, "");
    }

    function test_RevertWhen_DirectionOutOfRange() public {
        uint256 index = game.currentLevelIndex();
        vm.expectRevert(abi.encodeWithSelector(SqueekPuzzle.IllegalMove.selector, uint256(0)));
        game.submit(index, hex"04");
    }

    function test_RevertWhen_MoveIntoWall() public {
        uint256 index = game.currentLevelIndex();
        SqueekPuzzle.Level memory lv = game.levelAt(index);
        // 找到一步撞墙的方向，合约必须拒绝
        uint8 wallDir = 255;
        for (uint8 dir = 0; dir < 4; dir++) {
            (bool ok,,) = _step(lv.player, lv.boxes, lv.walls, dir);
            if (!ok) {
                wallDir = dir;
                break;
            }
        }
        assertTrue(wallDir != 255, "expected at least one blocked direction");
        vm.expectRevert(abi.encodeWithSelector(SqueekPuzzle.IllegalMove.selector, uint256(0)));
        game.submit(index, abi.encodePacked(wallDir));
    }

    function test_RevertWhen_NotSolved() public {
        uint256 index = game.currentLevelIndex();
        SqueekPuzzle.Level memory lv = game.levelAt(index);
        (bool solved, bytes memory moves) = solver.solve(lv.walls, lv.boxes, lv.targets, lv.player);
        assertTrue(solved);
        assertGt(moves.length, 1);

        // 去掉最后一步：路径全部合法，但坚果没全进窝
        bytes memory truncated = new bytes(moves.length - 1);
        for (uint256 i = 0; i < truncated.length; i++) {
            truncated[i] = moves[i];
        }
        vm.expectRevert(SqueekPuzzle.NotSolved.selector);
        game.submit(index, truncated);
    }

    // ------------------------------------------------------------------
    // 视图
    // ------------------------------------------------------------------

    function test_BoardMatchesLevelAt() public view {
        SqueekPuzzle.Board memory b = game.board();
        SqueekPuzzle.Level memory lv = game.levelAt(b.index);
        assertEq(b.index, game.currentLevelIndex());
        assertEq(b.certifiedRound, 48 * 10 + 5);
        assertEq(b.startRound, 480);
        assertEq(b.endRound, 528);
        assertEq(b.walls, lv.walls);
        assertEq(b.boxes, lv.boxes);
        assertEq(b.targets, lv.targets);
        assertEq(b.player, lv.player);
        assertEq(b.solved, 0);
    }

    // ------------------------------------------------------------------
    // 内部工具
    // ------------------------------------------------------------------

    function _assertStructure(SqueekPuzzle.Level memory lv, uint256 index) private pure {
        uint256 boxes;
        uint256 targets;
        for (uint256 cell = 0; cell < CELLS; cell++) {
            uint256 x = cell % SIZE;
            uint256 y = cell / SIZE;
            bool border = x == 0 || x == SIZE - 1 || y == 0 || y == SIZE - 1;
            if (border) {
                assertTrue((lv.walls >> cell) & 1 == 1, "border must be wall");
            }
            if ((lv.boxes >> cell) & 1 == 1) boxes++;
            if ((lv.targets >> cell) & 1 == 1) targets++;
            // 坚果和窝都不能压在墙上
            if ((lv.walls >> cell) & 1 == 1) {
                assertTrue((lv.boxes >> cell) & 1 == 0, "box on wall");
                assertTrue((lv.targets >> cell) & 1 == 0, "target on wall");
            }
        }
        assertEq(boxes, 3, "three boxes");
        assertEq(targets, 3, "three targets");
        assertEq((lv.walls >> lv.player) & 1, 0, "player on wall");
        assertEq((lv.boxes >> lv.player) & 1, 0, "player on box");
        // 开局至少两颗坚果不在窝上，避免"一步就过"
        uint256 off;
        uint64 diff = lv.boxes & ~lv.targets;
        while (diff != 0) {
            diff &= diff - 1;
            off++;
        }
        assertGe(off, 2, "level too easy");
        assertLt(index, type(uint32).max);
    }

    /// @dev 在测试内重放一段路径，得到终局状态
    function _run(SqueekPuzzle.Level memory lv, bytes memory moves)
        private
        pure
        returns (uint256 pos, uint64 boxes, bool ok)
    {
        pos = lv.player;
        boxes = lv.boxes;
        ok = true;
        for (uint256 i = 0; i < moves.length; i++) {
            bool stepOk;
            (stepOk, pos, boxes) = _step(pos, boxes, lv.walls, uint8(moves[i]));
            if (!stepOk) {
                ok = false;
                return (pos, boxes, ok);
            }
        }
    }

    /// @dev 与合约一致的移动规则
    function _step(uint256 pos, uint64 boxes, uint64 walls, uint8 dir)
        private
        pure
        returns (bool ok, uint256 nextPos, uint64 nextBoxes)
    {
        int256 delta;
        if (dir == 0) delta = -int256(SIZE);
        else if (dir == 1) delta = 1;
        else if (dir == 2) delta = int256(SIZE);
        else delta = -1;

        int256 next = int256(pos) + delta;
        if (next < 0 || next >= int256(CELLS)) return (false, 0, 0);
        uint256 n = uint256(next);
        if ((walls >> n) & 1 == 1) return (false, 0, 0);

        nextBoxes = boxes;
        if ((boxes >> n) & 1 == 1) {
            int256 beyond = next + delta;
            if (beyond < 0 || beyond >= int256(CELLS)) return (false, 0, 0);
            uint256 b = uint256(beyond);
            if ((walls >> b) & 1 == 1) return (false, 0, 0);
            if ((boxes >> b) & 1 == 1) return (false, 0, 0);
            nextBoxes = (boxes & ~(uint64(1) << n)) | (uint64(1) << b);
        }
        return (true, n, nextBoxes);
    }
}

/// @notice 回归测试：种子不能依赖 roundPage 的活跃轮次记录。
/// 真实 SqueekCore 只给"工作量 > 0"的轮次建记录，仓鼠睡一整段时 rounds 数组是空的。
/// 如果种子取自轮次 dataHash，这关就会直接读不出来（这是真机上踩到过的 bug）。
contract SqueekPuzzleZeroWorkTest is Test {
    function test_LevelStillReadableWhenNoActiveRoundRecords() public {
        MockSqueekCore core = new MockSqueekCore();
        core.setFrontier(uint64(48 * 5 + 3));
        core.setRecordsEnabled(false);
        SqueekPuzzle game = new SqueekPuzzle(ISqueekCore(address(core)));

        SqueekPuzzle.Board memory b = game.board();
        assertEq(b.index, 5);
        assertGt(b.walls, 0);
        // 同一关两次读出来必须一致
        SqueekPuzzle.Level memory a1 = game.levelAt(5);
        SqueekPuzzle.Level memory a2 = game.levelAt(5);
        assertEq(a1.walls, a2.walls);
        assertEq(a1.boxes, a2.boxes);
        assertEq(a1.targets, a2.targets);
        assertEq(a1.player, a2.player);
    }
}
