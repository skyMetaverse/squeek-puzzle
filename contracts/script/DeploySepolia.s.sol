// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SqueekPuzzle} from "../src/SqueekPuzzle.sol";
import {ISqueekCore} from "../src/interfaces/ISqueekCore.sol";

/// @title Sepolia 部署脚本
/// @notice 用官方文档里的 SqueekCore 代理地址部署游戏合约。
///
/// 用法：
///   export SQUEEK_CORE=0x74665dAecA35A2303e767E76a2FF1FB6F93e119f
///   forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC \
///     --broadcast --private-key $PRIVATE_KEY
///
/// 注意：SqueekCore 的 roundPage 只允许读已认证前沿以内的轮次；
///       部署后建议先用 cast 调一次 board() 确认能正常读出关卡。
contract DeploySepolia is Script {
    /// @dev 官方部署记录里的 SqueekCore 代理地址（chainId 11155111）
    address internal constant DEFAULT_CORE = 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f;

    function run() external {
        address coreAddr = vm.envOr("SQUEEK_CORE", DEFAULT_CORE);
        vm.startBroadcast();
        SqueekPuzzle game = new SqueekPuzzle(ISqueekCore(coreAddr));
        vm.stopBroadcast();

        console2.log("SqueekCore  ", coreAddr);
        console2.log("SqueekPuzzle", address(game));
    }
}
