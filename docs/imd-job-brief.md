# IMD 接入任务书：Squeek Puzzle 进度保存与恢复

当前状态：已支付 0.5 IMD，平台已受理，最近查询状态为 `executing`（执行中），尚未交付。

## 付款与任务记录

| 项目 | 已确认值 |
|---|---|
| IMD Job ID | `3075901d-fa05-4596-b659-1ada4de7dc49` |
| 任务进度 | <https://explorer.imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49> |
| Genesis 任务链接 | <https://imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49> |
| 付款网络 | Ethereum 主网，chain ID `1` |
| 付款交易 | <https://etherscan.io/tx/0x271193f4599cb83d9d2f6b97e586ca25847eb3a8607f732acea9d4c25d29b2cf> |
| 付款区块 | `26305482` |
| 付款钱包 | `0x00000082Bc916568Cb4479D3a218daFa60eBBA25` |
| 金额 | `500000000000000000` atomic units，精度 18，即 `0.5 IMD` |
| 动作 | `job.open@job-1` |
| 平台付款状态 | `order.status: paid`，`intake.state: admitted` |
| 任务受理时间 | `2026-10-30T12:11:00.460Z` |

已读取真实交易并解码 `request` calldata，确认任务正文与 `imd-job.request.json` 的 `input` 完全一致，
固定源码提交和 0.5 IMD 金额也一致。付款成功不代表开发已完成，交付后还需检查源码、测试和预览。
本文记录的是任务凭证；Squeekchain 的提交与最终批准仍遵循其规则。

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
- 公开源码：<https://github.com/skyMetaverse/squeek-puzzle>。
- 已验证的导入提交：`fc858c7073be5d063eecdcc65db8d1cdd17eca6b`。
- 请求文件：同目录 `imd-job.request.json`；`repoUrl` / `baseCommit` 直接使用 IMD 导入返回值。
- 根目录构建入口：`npm ci && npm run build`，产物 `dist/`；内部调用 `web/` 的原有构建。

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

- 用户已创建公开仓库并授权上传：`git@github.com:skyMetaverse/squeek-puzzle.git`，本地 `main` 已推送。
- IMD 的已有源码导入要求公开 GitHub 仓库和固定提交。当前网页没有本地 ZIP 上传入口。
- IMD 导入器只检查仓库根目录；原有 `web/` 子目录无法直接被识别。已增加根目录构建脚本，
  保留 `web/` / `contracts/` 分目录。按锁文件安装和构建已验证，根目录产物与 `web/dist/` 完全一致。
- 免费 `/requests/import` 已返回 `ok: true`，固定提交见上方。付款前需要重新获取未过期报价。
- 这是第一个 IMD 任务，应使用 `job.open`；`job.continue` 只适用于已经存在的 IMD 项目。
- 本次已由 Genesis 关联钱包 `0x00000082Bc916568Cb4479D3a218daFa60eBBA25` 付款，
  平台任务的 `paidBy` 与链上付款地址一致。
- 实时 capabilities 显示 `job.open` 价格为 `500000000000000000` atomic units，即 0.5 IMD（18 decimals）。
  付费构建支持 Ethereum / Robinhood Chain；Sepolia 的测试支付目前只列出 oracle，不支持网站构建。
- 官方说明：付费购买任务受理，不保证交付成功，也不保证 Squeekchain 最终批准 Genesis 项目。

## 免费预检结果

已实际完成以下免费调用：

| 接口 | 结果 |
|---|---|
| `POST /requests/import`，`kind: site` | HTTP 200，`ok: true`，`site.build: true` |
| `POST /requests/check` | HTTP 200，`blockers: []`，`suggestions: []` |
| `POST /requests/quote` | HTTP 201，`created: true`，`status: quoted`，无字段校验问题 |

平台给出的计划：

1. `build-website`：实现并检查网站。
2. `import-site`：从源码构建静态网站。
3. `site-content-check`：由另一代理检查将要托管的内容。
4. `design-critic`：由另一代理核对需求与设计（平台自动加入）。

`facts` 返回空数组。报价支付网络是 `eip155:1`（Ethereum 主网），金额是
`500000000000000000`，代币 `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7`，精度 18。
早期免费验证只创建了报价，没有付款或 Job ID；本次实际链上付款与任务受理结果见上方记录。
报价有效期十分钟；后续购买其他任务前仍需重新检查与报价。

任务要求交付源码和独立预览；`github: true`、`ipfs: true`，用于保留 IMD 开发成果与任务记录。
本任务不会自动替换现有 Vercel 生产站。

来源：<https://imd.fun/skill.md>、<https://imd.fun/skill/jobs.md>、<https://api.imd.fun/requests/capabilities>、
<https://explorer.imd.fun/launch?make=build-website>。
