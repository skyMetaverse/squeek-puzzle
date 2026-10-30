# SQUEK PUZZLE · 仓鼠推坚果

Squeekchain 上的**每日三关解谜**：把三颗坚果推进虚线窝里。界面支持**中 / 英双语**（右上角切换，会记住选择）。

- **关卡不是我们编的**：每 48 个已认证轮次（48 × 600s = 8 小时）一关，关卡种子来自 SqueekCore 在那一轮结束时的账本位置，在合约里确定性地生成。全世界同一时间看到同一关，没人能提前知道下一关长什么样。
- **成绩不是我们记的**：解完后用一笔交易提交整条移动路径，合约把每一步重放一遍；有一步走不通、或者最后坚果没全进窝，交易就失败。排行榜按步数最少排。
- **不碰钱**：没有代币、没有下注、没有授权、不需要托管。

## 目录结构

```
squeek-puzzle/
├── contracts/          # 后端：Solidity 合约（Foundry）
│   ├── src/
│   │   ├── SqueekPuzzle.sol        # 游戏主合约
│   │   ├── interfaces/ISqueekCore.sol
│   │   └── mocks/MockSqueekCore.sol
│   ├── test/           # 单元测试 + BFS 求解器
│   └── script/         # 本地 / Sepolia 部署脚本
└── web/                # 前端：React + TypeScript + Tailwind + viem（Vite）
    ├── src/
    └── scripts/        # 本地链端到端验证脚本
```

## 快速开始（本地）

需要：Foundry（forge / anvil）、Node 20.19+ 或 22.12+、Bun（跑验证脚本）。

```bash
# 1) 起本地链
anvil

# 2) 部署合约（另开一个终端）
cd contracts
forge install foundry-rs/forge-std   # 首次需要，拉取测试依赖
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 \
  --broadcast --private-key <anvil 打印的第一个私钥>
# 输出：
#   MockSqueekCore 0x5fbdb2315678afecb367f032d93f642f64180aa3
#   SqueekPuzzle   0xdc64a140aa3e981100a9beca4e685f962f0cf6c9

# 3) 前端
cd ../web
npm install
npm run dev          # http://localhost:5173
```

本地默认配置（`web/src/lib/config.ts`）已经指向上面这两个地址和 `http://127.0.0.1:8545`，不用改任何环境变量。
本地 mock 的轮长被设成 10 秒，所以**每 8 分钟换一关**，方便看换关效果。

钱包：MetaMask 添加网络 `http://127.0.0.1:8545`、Chain ID `31337`，导入 anvil 打印的任意测试私钥。

## 验证

```bash
# 合约单测（含 200 关可解性回归、零工作量轮次回归）
cd contracts && forge test

# 真实 Sepolia 状态下的接口校验（只读、不广播）
forge script script/CheckSepolia.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# 本地链端到端：解出最短解 → 发真实交易 → 核对事件与记账
cd ../web && E2E_PRIVATE_KEY=<anvil 打印的第一个私钥> bun run e2e

# 前端类型检查 + 构建
cd ../web && npm run build
```

## 部署到 Vercel

1. Vercel 新建项目，导入本仓库，**Root Directory 选 `web`**。
2. Build Command `npm run build`，Output Directory `dist`（Vite 默认，Vercel 会自动识别）。
3. 在 Environment Variables 里配置（见 `web/.env.example`）：
   - `VITE_CHAIN_ID=11155111`
   - `VITE_RPC_URL=<你的 Sepolia RPC>`
   - `VITE_PUZZLE_ADDRESS=<Sepolia 上部署的 SqueekPuzzle>`
   - `VITE_CORE_ADDRESS=0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`
   - `VITE_DEPLOY_BLOCK=<部署区块，用于日志回溯起点，可留空>`
4. 先按 `contracts/README.md` 把合约部署到 Sepolia，再把地址填进去。

> 前端是纯静态页面，不托管私钥、不代理任何交易。所有读写都直接打到链上。

## 设计要点（为什么这么做）

| 决策 | 原因 |
|---|---|
| 关卡在链上生成，前端只渲染 | 前端自己生成关卡，一旦与合约不一致就会出现"解出来但提交被拒"。合约是唯一真值。 |
| 用"反向推箱"构造关卡 | 先让三颗坚果都在窝上，再随机往回拉。每一步都是合法推动的逆操作，所以关卡**天然可解**，不需要在链上跑求解器（链上 BFS 不可行）。 |
| 种子取自 `roundPage(r, r, 0).end` | `roundPage` 的 `rounds` 数组**只包含有工作量的活跃轮次**，仓鼠睡一轮就没有记录。用 dataHash 当种子会在真实链上随机失败（实测踩过）。点读账本位置对任何已认证轮次都成立。 |
| 关卡编号取自 `settledThroughRound` | 只认已结算数据，不认 wall clock 和实时转速。前沿之后的轮次是"未知"不是"零"。 |
| 提交采用严格重放 | 撞墙/撞坚果直接 revert，而不是静默忽略。链上记录的步数就是玩家真实走过的步数。 |
| `core` 设为 immutable | 换预言机 = 改历史关卡，所以部署后不允许更换。 |

## 已知限制

- **提交 gas 偏高**：约 60–110 万 gas，因为 `submit` 会重新生成一遍关卡（约 12 次反向拉取 + 洪泛填充）。Sepolia 测试网可接受；上主网前应把生成结果缓存到 storage。
- **同一关可以反复提交**，合约只保留最少步数，但每次提交都要花 gas。
- **排行榜走事件日志**，前端只回溯最近 5000 个区块（一关约 2400 个区块），换关后旧关卡的成绩不会显示。
- **极端情况下关卡会偏简单**：小棋盘上反向构造的关卡可能被 BFS 找到很短的通路，实测约 6% 的关卡最短解 ≤ 6 步。
- 本仓库**没有**在 Sepolia 上真实部署（没有可用的部署私钥与测试币），合约只在本地区块链上验证过；Sepolia 路径用只读脚本对真实 SqueekCore 校验过接口与关卡生成。
