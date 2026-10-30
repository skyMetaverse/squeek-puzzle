// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SqueekPuzzle} from "../src/SqueekPuzzle.sol";
import {MockSqueekCore} from "../src/mocks/MockSqueekCore.sol";
import {ISqueekCore} from "../src/interfaces/ISqueekCore.sol";

/// @title 本地部署脚本
/// @notice 在 anvil 上部署 MockSqueekCore + SqueekPuzzle，并把 mock 设置成"会自动换关"的状态，
///         方便前端连着本地链直接玩。
///
/// 用法：
///   anvil
///   forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 \
///     --broadcast --private-key <anvil 默认私钥>
///
/// 环境变量（可选）：
///   MOCK_FRONTIER   初始已认证轮次前沿，默认 48*3+7（第 3 关第 7 轮）
///   MOCK_ROUND_SECS 本地轮长（秒），默认 10，方便几分钟内看到换关
contract DeployLocal is Script {
    function run() external {
        uint64 frontier = uint64(vm.envOr("MOCK_FRONTIER", uint256(48 * 3 + 7)));
        uint64 roundSecs = uint64(vm.envOr("MOCK_ROUND_SECS", uint256(10)));

        vm.startBroadcast();
        MockSqueekCore mock = new MockSqueekCore();
        mock.setRoundSeconds(roundSecs);
        mock.setFrontier(frontier);
        mock.setAutoAdvance(true);
        SqueekPuzzle game = new SqueekPuzzle(ISqueekCore(address(mock)));
        vm.stopBroadcast();

        console2.log("MockSqueekCore", address(mock));
        console2.log("SqueekPuzzle ", address(game));
        console2.log("frontier     ", frontier);
    }
}
