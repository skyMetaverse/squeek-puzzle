# contracts · SqueekPuzzle 合约

游戏的后端。一个合约 + 一个只读接口 + 一个测试替身。

```
src/
├── SqueekPuzzle.sol          # 游戏主合约：关卡生成、解法校验、成绩记录
├── interfaces/ISqueekCore.sol # 只用到 state / configuration / roundPage 三个只读方法
└── mocks/MockSqueekCore.sol  # 本地开发与单测用的 SqueekCore 替身
test/
├── SqueekPuzzle.t.sol        # 15 个测试
└── SokobanSolver.sol         # 测试专用 BFS 求解器（独立实现，用来交叉验证可解性）
script/
├── DeployLocal.s.sol         # anvil 部署（含 mock，自动换关）
├── DeploySepolia.s.sol       # Sepolia 部署（接真实 SqueekCore）
└── CheckSepolia.s.sol        # 只读校验：用真实链上状态验证接口解码与关卡生成
```

## 命令

```bash
forge build
forge test
forge test --match-test test_LevelsAreSolvable -vv

# 本地
anvil
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key <anvil 私钥>

# 用真实 Sepolia 状态校验（不广播）
forge script script/CheckSepolia.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

## 部署到测试网（私钥不暴露在终端）

**不要用 `--private-key`**：私钥会写进 shell history，也会被同机其它进程从 `ps` 看到。
用 Foundry 自带的加密 keystore：

```bash
# 1) 导入私钥。私钥和解锁密码都是隐藏输入（不回显、不进 history）
cast wallet import sepolia-deployer --interactive
#   Enter private key:  ← 粘贴私钥，屏幕无回显
#   Enter password:     ← 设置解锁密码，屏幕无回显

# 2) 确认地址（这就是后面的 --sender）
cast wallet address --account sepolia-deployer

# 3) RPC 也走变量：带 API key 的 URL 不要直接写在命令行里
read -rs SEPOLIA_RPC          # 粘贴 RPC，回车，屏幕无回显

# 4) 先干跑一遍（不广播，不改链上状态）
forge script script/DeploySepolia.s.sol \
  --rpc-url "$SEPOLIA_RPC" \
  --account sepolia-deployer --sender 0x你的地址

# 5) 正式部署（会再提示一次 keystore 密码）
forge script script/DeploySepolia.s.sol \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast \
  --account sepolia-deployer --sender 0x你的地址
```

原理与边界：

| 项 | 说明 |
|---|---|
| keystore 位置 | `~/.foundry/keystores/<名字>`，scrypt 加密；文件里没有明文私钥 |
| 解锁时机 | `forge script` 运行时在进程内存里解密，用完即释放 |
| shell history | 只有 `--account sepolia-deployer` 这类名字，没有私钥 |
| `ps` 可见性 | 命令行里没有私钥，同机进程看不到 |
| 密码别和 keystore 放一起 | keystore 泄露 + 密码泄露 = 私钥泄露 |

其它可选方案：

```bash
# 硬件钱包（私钥永远不离开设备）
forge script script/DeploySepolia.s.sol --rpc-url "$SEPOLIA_RPC" --broadcast --ledger --sender 0x你的地址

# CI / 无人值守：密码放独立文件（chmod 600），别塞进命令行
forge script script/DeploySepolia.s.sol --rpc-url "$SEPOLIA_RPC" --broadcast \
  --account sepolia-deployer --password-file /run/secrets/keystore-pass

# 团队 / 云 KMS
forge script script/DeploySepolia.s.sol --rpc-url "$SEPOLIA_RPC" --broadcast --aws
```

### ⚠️ Sepolia 的部署 gas：必须手动放大

Sepolia 已经升级到 **Osaka**，合约代码的部署单价约为本地 anvil 的 **7 倍**。
Foundry 1.4.3 的估算器仍按旧价格计算，所以 `forge script` 的估算会低 5~7 倍，
直接 `--broadcast` 会 **out of gas**（交易失败，gas 全烧掉）。

实测（SqueekPuzzle，initcode 7,266 字节）：

| 来源 | gas |
|---|---|
| `forge script` 本地估算 | 2,048,376 |
| 链上 `eth_estimateGas` | **11,165,247** |
| 本地 anvil 实际消耗 | 1,575,674 |
| 单笔交易上限（EIP-7825 / Osaka） | 16,777,216 |

由此得出：

- **1000 万不够** → 仍然 OOG
- **2000 万会被节点拒绝** → 超过 EIP-7825 的单笔上限 16,777,216
- 正确区间是 **1200~1300 万**

两种写法，任选其一：

```bash
# A) 继续用脚本，把估算放大 10 倍 → 实际 gas limit 15,756,740（仍在 16.7M 上限内）
forge script script/DeploySepolia.s.sol \
  --rpc-url "$SEPOLIA_RPC" --broadcast -g 1000 \
  --account sepolia-deployer --sender 0x你的地址

# B) 直接指定 gas limit，不依赖估算器（合约变大时更可控）
forge create src/SqueekPuzzle.sol:SqueekPuzzle \
  --rpc-url "$SEPOLIA_RPC" --broadcast \
  --account sepolia-deployer \
  --gas-limit 13000000 \
  --constructor-args 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f
# 注意：--constructor-args 是可变参数，必须放在最后，
#       否则它会把后面的 --gas-limit / --broadcast 当成构造参数吃掉（dry-run 且用错 gas）
```

判断依据是 `cast estimate` / `eth_estimateGas` 给的数——**链自己算的是对的**，只有 forge 的本地估算偏低：

```bash
cast estimate --create "$(cast tx <失败的hash> input --rpc-url "$SEPOLIA_RPC")" \
  --from 0x你的地址 --rpc-url "$SEPOLIA_RPC"
```

部署完拿地址和区块号填前端环境变量：

```bash
jq -r '.transactions[] | select(.contractName=="SqueekPuzzle") | .contractAddress' \
  broadcast/DeploySepolia.s.sol/11155111/run-latest.json
# 部署区块（JSON 里是十六进制，前端用 BigInt() 解析，可以直接填进 VITE_DEPLOY_BLOCK）
jq -r '.receipts[0].blockNumber' broadcast/DeploySepolia.s.sol/11155111/run-latest.json
```

## 合约接口

```solidity
function currentLevelIndex() view returns (uint256);       // 已认证轮次前沿 / 48
function levelAt(uint256 index) view returns (Level);      // 生成指定关卡
function board() view returns (Board);                     // 前端一次拿全
function bestMoves(uint256 index, address player) view returns (uint256);
function solvedCount(uint256 index) view returns (uint256);
function submit(uint256 index, bytes moves);               // moves 每字节 0=上 1=右 2=下 3=左
event Solved(uint256 indexed level, address indexed player, uint256 moves, uint256 at);
```

`Level` / `Board` 用三种 36 位位图表示墙、坚果、窝（`bit i` = 第 i 格，按行优先）。

## 关卡怎么生成的

1. 关卡号 `index = settledThroughRound / 48`。
2. 种子 `seed = keccak(index, roundPage(index*48, index*48, 0).end 的三个字段, 合约地址, chainId)`。
   该轮一旦认证，账本位置永久固定 → 同一关永远一样；该轮在关卡开启前未结算 → 没人能提前算出来。
3. 生成：外圈墙 + 1 格内圈障碍 → 随机放 3 个窝 → 坚果先全部放在窝上（此时已通关）→
   做 12 次**反向拉取**（每次都是某次合法推动的逆操作）→ 检查质量门槛。
   反向构造保证关卡一定可解，不需要在链上跑求解器。

## 调参

全部是 `public constant`，改完需要重新部署：

| 常量 | 值 | 含义 |
|---|---|---|
| `ROUNDS_PER_LEVEL` | 48 | 48 轮 = 8 小时 = 一天三关 |
| `SIZE` | 6 | 棋盘 6x6 |
| `BOX_COUNT` | 3 | 三颗坚果 / 三个窝 |
| `INTERIOR_WALLS` | 1 | 内圈障碍数量（0/1/2 都试过，1 的关卡质量最好） |
| `PULL_STEPS` | 12 | 反向拉取次数 |
| `MIN_PULLS` | 8 | 至少拉够几步，否则判定为太简单 |
| `MIN_AREA` | 6 | 每次拉取后仓鼠还要能走到这么多格，避免被自己拉的坚果堵死 |
| `MAX_MOVES` | 200 | 单次提交的最大步数 |

质量实测（200 关，用测试里的 BFS 求解器跑）：**0 关生成失败、0 关不可解**，最短解平均 12 步、最长 30 步。

## 为什么用 `roundPage(r, r, 0).end` 当种子

这是踩过的坑，写下来免得再犯：

- 最初用轮次的 `dataHash` 当种子。真实 SqueekCore 的 `roundPage` 里 `rounds` 数组**只包含工作量 > 0 的活跃轮次**，仓鼠睡一整段时数组是空的 —— 于是关卡读不出来，`board()` 直接 revert。
- 另外 `roundPage` 返回的是**一个含动态数组的结构体**，ABI 编码带前导 offset。按平铺 tuple 声明接口会解码错位、直接 revert。
- 现在改用文档给出的点读方式 `roundPage(r, r, 0).end`：对任何已认证轮次都成立，round 0 返回启动位置。
- 上面两点都是拿真实 Sepolia 状态跑 `CheckSepolia.s.sol` 验证出来的，不是从文档推断的。
