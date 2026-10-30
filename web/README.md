# web · SQUEK PUZZLE 前端

React 19 + TypeScript + Tailwind CSS v4 + viem，Vite 构建，纯静态页面。

## 开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build，产物在 dist/
npm run typecheck
```

只支持 **Sepolia 正式部署**（`SqueekPuzzle 0x49d0227b…49c391`，区块 12025550），
链与地址写在 `src/lib/config.ts`，**不需要任何环境变量**。
本地 anvil 的链路已经从前端移除（合约侧的本地测试仍在 `contracts/` 与 `scripts/` 里）。

可覆盖项（一般不用动）：`VITE_RPC_URL` / `VITE_PUZZLE_ADDRESS` / `VITE_CORE_ADDRESS` /
`VITE_DEPLOY_BLOCK`，见 `.env.example`。

## 目录

```
src/
├── App.tsx                  # 主界面与游戏流程编排
├── index.css                # Tailwind v4 + 主题变量（色板、字体）
├── lib/
│   ├── i18n.tsx             # 中英双语字典 + Context（t / 语言切换 / 记忆）
│   ├── abi.ts               # 合约 ABI（只声明用到的方法）
│   ├── client.ts            # viem 只读客户端
│   ├── config.ts            # 链、地址、RPC（环境变量）
│   ├── format.ts            # 地址缩写、错误翻译、时长格式化
│   └── game.ts              # 棋盘规则（与合约 _apply 一一对应）
├── hooks/
│   ├── useWallet.ts         # 连接 / 退出网站会话 / 切网络 / 发交易
│   ├── usePuzzle.ts         # 读当前关卡、我的成绩、排行榜
│   └── useCoreConfig.ts     # 读 SqueekCore 轮长（算换关倒计时）
└── components/
    ├── Board.tsx            # 6x6 棋盘（背景格 + 绝对定位精灵）
    ├── LangToggle.tsx       # 中 / EN 切换
    ├── Rich.tsx             # 把文案里的 **高亮** 渲染成金色
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

## 中英双语

- 文案全部集中在 `src/lib/i18n.tsx`：中文是基准字典，英文必须与它的 key 一一对应，
  少写一条会直接编译报错。**不要在 JSX 里直接写中文或英文。**
- 用法：`const { t } = useI18n();` → `t("submit.button", { moves: 12 })`。
- 文案里的 `{name}` 是占位符；`**文字**` 表示高亮，用 `<Rich text={...} />` 渲染
  （不用 `dangerouslySetInnerHTML`，避免注入面）。
- 语言选择：本地记忆（`localStorage: squeek-puzzle:lang`）> 浏览器语言 > 中文；
  切换时同步 `<html lang>` 和页面标题。
- 与文案相关的工具函数（`formatDuration` / `readableError`）都接收 `t`，不自己写死文字。
- 不翻译的内容：品牌名、`Level` 标签、链名（`SEPOLIA`）、合约名、`ESC` 键名。

## 关键实现说明

- **棋盘动画**：背景格用 CSS grid 铺满，坚果和仓鼠是绝对定位的精灵，用
  `transform: translate(x*100%, y*100%)` 定位（每格 1/6 宽），移动时靠 CSS transition 平滑过渡。
  坚果按数组顺序渲染，位置变化时 React 复用同一个 DOM 节点，动画才不会错位。
  > 注意：精灵外层**不能用百分比 padding** 收边——百分比 padding 按包含块宽度计算，会把内容盒压成 0，图形直接消失。这里用内层 `absolute inset-[..]`。
- **规则单一来源**：`lib/game.ts` 的 `step()` 与合约 `_apply` 逐行对应。改动任何一边都要同步另一边，
  否则会出现"本地通关但提交被拒"。
- **不信任缓存**：进交易的数值（关卡号、步数）全部以合约读数为准；排行榜只用于展示。
- **错误处理**：`board()` 读失败、RPC 超时、钱包拒绝签名、交易 revert 都有独立提示，不会把失败显示成 0。
- **网络不对时禁止发交易**，地址旁仍可切换网络或断开连接。
- **断开钱包**：点击顶栏地址右侧的电源图标即可退出网站会话，立即清空地址、网络状态和个人成绩。
  退出选择保存在 `localStorage: squeek-puzzle:wallet-disconnected`，刷新页面或收到钱包账户事件后
  仍保持断开，直到再次主动连接成功。游戏进度保留，可以继续解谜。
  网站会话与钱包内的站点授权独立；如需撤销钱包授权，可在钱包的已连接网站列表中操作。

## 部署到 Vercel

1. 导入仓库，**Root Directory 选 `web`**。
2. Framework Preset 会自动识别为 Vite：Build `npm run build`，Output `dist`。
3. **不需要配置环境变量**——默认就是 Sepolia 正式部署。只有想换 RPC 或换合约地址时才需要覆盖。
   注意 `.vercelignore` 已经把 `node_modules` / `dist` / `scripts` 排除，上传体积只有十几 KB，
   依赖和构建都在 Vercel 云端完成。
4. 单页应用，没有前端路由，不需要 rewrite 规则。

## 合约侧端到端验证（不参与前端构建）

`scripts/` 目录是合约的验证工具，不会被前端打包、也不会部署到 Vercel：

```bash
# 需要先在本地 anvil 上跑 contracts/script/DeployLocal.s.sol
E2E_PRIVATE_KEY=<anvil 打印的第一个私钥> bun run e2e
```

脚本会用独立实现的 BFS 求解器解出当前关卡的最短解，发一笔真实交易提交，
再核对 `bestMoves` / `solvedCount` / `Solved` 事件，最后推进 mock 的前沿验证换关。
