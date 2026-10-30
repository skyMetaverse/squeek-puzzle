// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SqueekPuzzle} from "../src/SqueekPuzzle.sol";
import {ISqueekCore} from "../src/interfaces/ISqueekCore.sol";

/// @title 在真实 Sepolia 状态下验证合约接口
/// @notice 这个脚本只做本地模拟（不加 --broadcast 不会真的部署），
///         目的是用真实链上状态验证 ISqueekCore 的 state()/roundPage() 解码是否对得上。
///
/// 用法：
///   forge script script/CheckSepolia.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com
contract CheckSepolia is Script {
    address internal constant DEFAULT_CORE = 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f;

    function run() external {
        address coreAddr = vm.envOr("SQUEEK_CORE", DEFAULT_CORE);
        ISqueekCore core = ISqueekCore(coreAddr);

        ISqueekCore.CoreState memory st = core.state();
        console2.log("settledThroughRound", st.settledThroughRound);
        console2.log("blockHeight        ", st.blockHeight);
        console2.log("workPerThousandBlk ", st.workPerThousandBlocks);
        console2.log("paused             ", st.paused);

        ISqueekCore.CoreConfiguration memory cfg = core.configuration();
        console2.log("genesisTimestamp   ", cfg.genesisTimestamp);
        console2.log("roundDuration      ", cfg.roundDuration);
        console2.log("blockUnitsPerBlock ", cfg.blockUnitsPerBlock);
        console2.log("targetBlocks/Round ", cfg.targetBlocksPerActiveRound);

        SqueekPuzzle game = new SqueekPuzzle(core);
        uint256 index = game.currentLevelIndex();
        console2.log("currentLevelIndex  ", index);

        SqueekPuzzle.Board memory b = game.board();
        console2.log("level              ", b.index);
        console2.log("startRound         ", b.startRound);
        console2.log("endRound           ", b.endRound);
        console2.log("walls              ", b.walls);
        console2.log("boxes              ", b.boxes);
        console2.log("targets            ", b.targets);
        console2.log("player             ", b.player);
    }
}
