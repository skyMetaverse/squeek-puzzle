# web · SQUEK PUZZLE 前端

React 19 + TypeScript + Tailwind CSS v4 + viem，Vite 构建，纯静态页面。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build，产物在 dist/
npm run typecheck
```

默认连本地 anvil（Chain ID 31337，合约地址写死在 `src/lib/config.ts` 的默认值里）。
连其它网络时用环境变量覆盖，见 `.env.example`。

## 目录

```
src/
├── App.tsx                  # 主界面与游戏流程编排
├── index.css                # Tailwind v4 + 主题变量（色板、字体）
├── lib/
│   ├── abi.ts               # 合约 ABI（只声明用到的方法）
│   ├── client.ts            # viem 只读客户端
│   ├── config.ts            # 链、地址、RPC（环境变量）
│   ├── format.ts            # 地址缩写、错误翻译、时长格式化
│   └── game.ts              # 棋盘规则（与合约 _apply 一一对应）
├── hooks/
│   ├── useWallet.ts         # 连接钱包 / 切网络 / 发交易
│   ├── usePuzzle.ts         # 读当前关卡、我的成绩、排行榜
│   └── useCoreConfig.ts     # 读 SqueekCore 轮长（算换关倒计时）
└── components/
    ├── Board.tsx            # 6x6 棋盘（背景格 + 绝对定位精灵）
    ├── Sprites.tsx          # 仓鼠 / 坚果 / 窝的 SVG
    ├── Dpad.tsx             # 移动端方向键
    ├── Leaderboard.tsx      # 本关排行榜
    ├── ConnectButton.tsx    # 钱包按钮（三种状态）
    ├── RulesModal.tsx       # 规则 + 合约地址
    └── Panel.tsx            # 卡片容器
scripts/
├── e2e-anvil.ts             # 本地链端到端验证
├── solver.ts                # 独立的 BFS 求解器
└── current.ts               # 打印当前关卡与参考解（手工验证用）
```

## 关键实现说明

- **棋盘动画**：背景格用 CSS grid 铺满，坚果和仓鼠是绝对定位的精灵，用
  `transform: translate(x*100%, y*100%)` 定位（每格 1/6 宽），移动时靠 CSS transition 平滑过渡。
  坚果按数组顺序渲染，位置变化时 React 复用同一个 DOM 节点，动画才不会错位。
  > 注意：精灵外层**不能用百分比 padding** 收边——百分比 padding 按包含块宽度计算，会把内容盒压成 0，图形直接消失。这里用内层 `absolute inset-[..]`。
- **规则单一来源**：`lib/game.ts` 的 `step()` 与合约 `_apply` 逐行对应。改动任何一边都要同步另一边，
  否则会出现"本地通关但提交被拒"。
- **不信任缓存**：进交易的数值（关卡号、步数）全部以合约读数为准；排行榜只用于展示。
- **错误处理**：`board()` 读失败、RPC 超时、钱包拒绝签名、交易 revert 都有独立提示，不会把失败显示成 0。
- **网络不对时禁止发交易**，只给"切换网络"入口。

## 部署到 Vercel

1. 导入仓库，**Root Directory 选 `web`**。
2. Framework Preset 会自动识别为 Vite：Build `npm run build`，Output `dist`。
3. 环境变量按 `.env.example` 里的 Sepolia 一组填写。
4. 单页应用，没有前端路由，不需要 rewrite 规则。

## 本地端到端验证

```bash
# 需要先 anvil + DeployLocal 部署
E2E_PRIVATE_KEY=<anvil 打印的第一个私钥> bun run e2e
```

脚本会用独立实现的 BFS 求解器解出当前关卡的最短解，发一笔真实交易提交，
再核对 `bestMoves` / `solvedCount` / `Solved` 事件，最后推进 mock 的前沿验证换关。
