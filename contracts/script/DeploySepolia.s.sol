// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {SqueekPuzzle} from "../src/SqueekPuzzle.sol";
import {ISqueekCore} from "../src/interfaces/ISqueekCore.sol";

/// @title Sepolia 部署脚本
/// @notice 用官方文档里的 SqueekCore 代理地址部署游戏合约。
///
/// 用法（推荐：私钥不进命令行、不进 shell history、不出现在 ps 里）：
///   # 1) 导入加密 keystore，私钥和密码都是隐藏输入
///   cast wallet import sepolia-deployer --interactive
///   cast wallet address --account sepolia-deployer      # 拿到 --sender 地址
///
///   # 2) RPC 也用变量，避免带 API key 的 URL 落进 history
///   read -rs SEPOLIA_RPC
///
///   # 3) 部署（会提示输入 keystore 密码，同样隐藏）
///   #    注意 -g 1000：Sepolia 已升级 Osaka，代码部署单价约为本地 anvil 的 7 倍，
///   #    Foundry 的估算器仍按旧价格算，不加这个参数会 out of gas（详见 README）
///   forge script script/DeploySepolia.s.sol \
///     --rpc-url "$SEPOLIA_RPC" \
///     --broadcast -g 1000 \
///     --account sepolia-deployer \
///     --sender 0x你的地址
///
/// 不要用 --private-key：它会把私钥写进 shell history，也能被同机其它进程从 ps 看到。
///
/// 注意：SqueekCore 的 roundPage 只允许读已认证前沿以内的轮次；
///       部署后建议先调一次 board() 确认能正常读出关卡。
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
