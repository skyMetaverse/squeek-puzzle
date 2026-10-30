# IMD 接入任务书：Squeek Puzzle 进度保存与恢复

当前状态：准备阶段，尚未创建付费 IMD 任务。本文不是 IMD Job ID，不能拿来填写 Genesis 提交表。

## 任务范围

在现有游戏上增加一个实际功能：自动保存当关的解谜进度，刷新或关闭页面后可以恢复。
保留 6×6 推坚果玩法、每 48 个已认证轮次换关、中英双语、钱包连接与退出、链上成绩和排行榜。

现有线上游戏：<https://squeek-puzzle.vercel.app/>

- 网络：Sepolia，chain ID `11155111`。
- 游戏合约：`0x49D0227b7E6d94A3c2C321B1c5770Ab39149C391`。
- 游戏部署区块：`12025550`。
- SqueekCore：`0x74665dAecA35A2303e767E76a2FF1FB6F93e119f`。
- 区块浏览器：<https://sepolia.etherscan.io/>。
- 前端目录：`web/`，React + TypeScript + Tailwind CSS + viem，Vite 构建，适配 Vercel 静态部署。
- 原始源码基准：本地提交 `756c67d70c31fff5b0b486659199b11abcef7bf5`。
- 请求模板：同目录 `imd-job.request.template.json`。其中仓库 URL 为拟议目标，尚未发布；
  该文件不能直接用于付费，必须先用源码导入返回的固定提交替换。

本次只改前端，现有合约作为已部署依赖。任务不包含新币、收费玩法、合约重部署、资金托管或交易自动签名。

## 给 IMD 的英文需求（可直接粘贴）

```text
Extend the existing Squeek Puzzle game with reliable saved progress and resume for the current puzzle. This is an independently developed game now being extended through IMD; describe authorship accurately.

Existing product: https://squeek-puzzle.vercel.app/
Reuse the imported source repository. The frontend is under web/, built with React, TypeScript, Tailwind CSS, Vite and viem. Preserve the existing dark/gold hamster visual design, 6x6 Sokoban board with three nuts and three nests, Chinese/English language switch, wallet connect/disconnect, onchain score submission, leaderboard and mobile direction pad. Keep the game simple.

Use the EXISTING Sepolia deployment (chain ID 11155111):
- SqueekPuzzle: 0x49D0227b7E6d94A3c2C321B1c5770Ab39149C391
- SqueekCore: 0x74665dAecA35A2303e767E76a2FF1FB6F93e119f
- Puzzle deployment block: 12025550
- Explorer: https://sepolia.etherscan.io/
The chain-derived puzzle is the source of truth. Read board() using the existing ABI in web/src/lib/abi.ts. Keep uint64 and wider values as bigint. Keep the existing cadence of 48 certified SqueekCore rounds per puzzle (nominally eight hours). Settlement may be delayed; do not replace the certified frontier with a wall-clock timer.

Implement saved progress in the existing web/src/App.tsx game state flow, with a small reusable helper/hook in web/src/:
1. Save each valid move and undo/reset immediately to browser storage. Scope saved progress by chain ID, puzzle contract address, level index and seed. Do not store wallet credentials or private keys.
2. After fetching the current onchain board, restore only a matching saved puzzle. Rebuild the state by replaying every saved direction through the existing step() function in web/src/lib/game.ts; never trust saved player positions, nut positions, scores or a stored "solved" flag.
3. Reject malformed JSON, invalid direction values, incompatible schemas, illegal moves and saved histories beyond the existing onchain MAX_MOVES limit of 200. Discard the invalid save and start from the fetched board with a concise translated message. Do not allow a forged save to bypass contract validation.
4. A new level or changed seed must not reuse the previous level's moves. Do not lose valid progress merely because the ten-second poll returns a new object with the same level index and seed. Switching languages or disconnecting the wallet must preserve the current puzzle progress.
5. Reset must replace or clear the saved progress so a refresh does not resurrect the old path. Undo must persist the shortened path. A restored completed puzzle may show the existing submit action, but never automatically request a wallet signature or broadcast a transaction.
6. If localStorage is blocked or full, keep gameplay usable in memory and show a small translated notice that progress cannot be saved. Avoid repeated warning spam on each move.
7. Add concise Chinese and English messages to web/src/lib/i18n.tsx and keep the existing language and wallet-disconnect persistence behavior.
8. Cover valid resume, undo/reset, expired puzzle, changed seed, corrupted/tampered save, blocked storage and language/wallet changes with meaningful automated tests. Run npm ci and npm run build in web/, and verify the main flow in a browser at desktop and 390px mobile widths. Document commands and results in web/README.md. Add necessary Chinese comments to new/modified core logic.

Leave contracts/ and the current deployed addresses unchanged. Do not add local-chain mode, create tokens, request secrets, send payments or deploy a new contract. Use existing dependencies when possible; any necessary new dependency must have an exact version and a committed lockfile. Deliver working frontend source, tests, documentation and a runnable static build suitable for Vercel. A separate IMD preview URL is fine; do not replace the current Vercel production site during this job.
```

## 验收标准

1. 移动数步后刷新，步数和棋盘恢复；撤销与重来结果也能跨刷新保持。
2. 新关卡、不同种子、无效存档不会污染当前棋盘。
3. 篡改存档无法伪造通关，链上仍会重放校验提交路径。
4. 切换语言或断开钱包后，解谜进度保留。
5. 存储不可用时仍可玩；中文、英文和手机界面提示正常。
6. `web/` 下构建通过，有可复核的测试结果和交付源码。

## IMD 接入前置条件

- 当前项目没有 remote，也没有已存在的 `skyMetaverse/squeek-puzzle` 仓库。
- IMD 的已有源码导入要求公开 GitHub 仓库和固定提交。当前网页没有本地 ZIP 上传入口。
- 用户此前明确要求不用推远程，因此尚未创建或发布公开仓库。
- 待用户允许发布纯源码后，先执行 IMD 的免费 `/requests/import`，把返回的 `repoUrl` / `baseCommit`
  写进请求，再运行 `/requests/check` 和免费 `/requests/quote`；全部通过后才进入付款。
- 这是第一个 IMD 任务，应使用 `job.open`；`job.continue` 只适用于已经存在的 IMD 项目。
- 付款使用 Genesis 已验证的钱包。此前部署钱包为 `0x00000082Bc916568Cb4479D3a218daFa60eBBA25`，
  付款前仍需用户确认该钱包是本次项目要绑定的钱包。
- 实时 capabilities 显示 `job.open` 价格为 `500000000000000000` atomic units，即 0.5 IMD（18 decimals）。
  付费构建支持 Ethereum / Robinhood Chain；Sepolia 的测试支付目前只列出 oracle，不支持网站构建。
- 官方说明：付费购买任务受理，不保证交付成功，也不保证 Squeekchain 最终批准 Genesis 项目。

## 免费预检结果

已对请求模板实际调用 `POST https://api.imd.fun/requests/check`，HTTP 200。
初次预检提示导入的网站托管需要 `site-content-check`，已将任务改为
`build-website` → `site-content-check` 两步并再次检查。

当前仅剩以下阻塞，尚不满足付费条件：

```json
{
  "code": "not_found",
  "detail": "no public repository at github.com/skyMetaverse/squeek-puzzle: a private one cannot be built, since workers clone without credentials"
}
```

`plan` / `facts` 目前为空，不能把本次预检当作完整任务批准。
源码公开后还需要重新导入、免费检查和免费报价，检查结果可能出现新的要求。

来源：<https://imd.fun/skill.md>、<https://imd.fun/skill/jobs.md>、<https://api.imd.fun/requests/capabilities>、
<https://explorer.imd.fun/launch?make=build-website>。
