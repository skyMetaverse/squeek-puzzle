# IMD 源码验证与任务阻塞记录

任务：<https://explorer.imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49>

当前阶段：任务已结束本轮执行并进入 `blocked`，原因为 `node import_site: runtime_error`。
第一轮修正的 `build_website` 已接受；`import_site` 三次尝试后失败，后续设计和内容复核未重新执行。
结果仍是 `complete=false`，正式 `delivery.commit` / `deliveredAt` 为空，不能视为交付成功。
失败时间为 `2026-10-30T13:06:11.630Z`。公开 API 的相关字段见 [状态与失败证据](imd-status-evidence.json)。

## 被检查的初版产物

- 源提交：`fc858c7073be5d063eecdcc65db8d1cdd17eca6b`。
- IMD 初版提交：`f484f160116c988cdb22b2579978c43c32dfaca0`。
- 源码包：<https://api.imd.fun/bundles/f7ac5cf171c6cdbdc443f4761ca7942b908e349ad30c992ebc41cc5615c5d951>。
- 下载后 SHA-256 与 URL 标识一致，`git bundle verify` 通过。
- 在 `/tmp` 中创建独立副本进行验证，没有合并到本仓库，也没有部署到生产站。

## 独立验证结果

检查了改动文件清单、依赖及测试入口后，在隔离副本执行：

```sh
cd web
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/progress.test.mjs
npm run build
IMD_PLAYWRIGHT=<本机已有 Playwright 模块的绝对路径> node tests/browser.mjs --live
```

| 检查 | 实际结果 |
|---|---|
| 存档单测 | 33 / 33 通过 |
| TypeScript + Vite 生产构建 | 通过 |
| Chromium 浏览器验证 | 18 / 18 通过，含 17 个模拟场景和 1 个只读真实 Sepolia 场景 |
| 核心存档生命周期静态检查 | 未确认实质行为缺陷；命名空间、路径重放、200 步边界、存储异常、撤销/重来均检查 |
| 敏感改动范围 | 初版没有修改 `contracts/`、ABI、部署地址或链配置，没有修改依赖及锁文件 |

验证没有签名、发交易或请求钱包付款。构建仍有既有的 `node:worker_threads` 外部化和 >500 kB 分块提示。
历史关卡存档键仍会留在浏览器中，但通过 chain / contract / index / seed 隔离，不会恢复到新关。

## 初版的平台复核发现

平台 `design_critic` 在 `2026-10-30T12:38:44.418Z` 的活动说明中提到：

1. RPC 错误文字可能使 390px 手机页面产生横向溢出。
2. 规则弹窗打开时，后台轮询可能将键盘焦点重置到关闭按钮。
3. 通关后未安装钱包时，“安装钱包”操作可能只展示错误。

以上是初版的复核发现，第一轮修正的独立验证见下文。
正式交付必须重新核对最终提交，不能把初版的验证结果当成后续版本的证明。

IMD 的节点 `accepted` 当前是结构验收，平台注明未为该类节点运行测试套件；
本文件中的测试数字来自本地独立复跑。源码包已出现不等于 `delivery.commit` 已生成。

## 第一轮修正的独立验证

- 源码提交：`7b0829e65ce45ca0885986e483fbde6c59e55a38`。
- [修正版 bundle](https://api.imd.fun/bundles/7ec48d93a23b5f930491839174f0386e57a86aefcda5834586874b497fcd8fb0)，下载后 SHA-256 与 URL 标识一致，Git bundle 校验通过。
- 相比初版，业务修改集中在 `App.tsx` 的错误换行、稳定关闭回调、安装钱包链接，以及 `usePuzzle.ts` 复用简短错误信息；测试、文档和静态产物同步更新。
- 相比导入基线，合约、ABI、网络/地址配置、钱包 hook、依赖清单和锁文件均未修改。

| 检查 | 独立复跑结果 |
|---|---|
| TypeScript + Vite 生产构建 | 通过；原有构建警告仍在 |
| 存档单测 | 33 / 33 通过 |
| Chromium，包括真实 Sepolia 只读场景 | 23 / 23 通过 |
| WebKit，模拟 RPC / 钱包场景 | 20 / 22 通过；两项弹窗焦点返回断言失败 |
| 初版三项问题的修复 | 错误页在 320/390px 无横向溢出；轮询不再夺走弹窗链接焦点；安装操作打开下载目标 |
| 提交产物与本机重建比较 | 13 个文件、688,913 字节，逐文件 SHA-256 完全一致 |
| 源码空白检查 | `web/src`、`web/tests`、HTML 和 Vite 配置通过；上游字体许可证有原始 CRLF/行末空白，不把全树格式检查表述为通过 |

WebKit 失败已进一步缩小：原生鼠标点击打开按钮时，React 点击处理前的活动元素是 `BODY`，
弹窗记录并最终返回该元素；键盘聚焦按钮后按 Enter 打开、Escape 关闭，则正确回到打开按钮。
等待两帧不改变鼠标路径结果，排除了测试断言过早；轮询后的弹窗内部焦点保持正常。
这属于鼠标打开后回焦的跨浏览器限制，不将 WebKit 整套测试表述为通过，也不等同于实体 Safari 验证。

## 独立确认的并发风险

内容复核另报两项中等问题。其一已在修正版实际静态应用中独立复现两次：

1. 模拟 localStorage 写满，保留第一轮旧关卡的 `board()` 响应。
2. 下一轮先返回新关卡，在新关卡移动一步，内存步数为 `1`。
3. 释放迟到的旧响应：界面回退旧关卡，路径变成空。
4. 再读到当前新关卡：步数仍为 `0`，刚才的一步丢失。

根因是 `usePuzzle.ts` 的十秒轮询可以并发；`cancelled` 只区分 effect 生命周期，
不能拦截同一 effect 中迟到的旧响应。旧响应触发身份切换后，`useSavedPuzzle` 重新恢复；
写入失败时没有新关卡存档可恢复。该问题尚未修复，因此不能仅凭既有 33 / 23 用例通过就上线。

另一项内容复核发现：只查询最近 5,000 个块，会在结算长期停滞时漏掉同一关卡的早期成绩。
相应固定窗口代码存在；本次未对该项做独立端到端复现，保留为待确认风险。

## 平台阻塞证据与后续

`GET /jobs/:id/submissions` 的第一轮修正导入尝试显示：

- 第 1 次：`runtime_error` / `machine`；摘要为 `the task produced no changes`，同时报告构建、33 单测和 22 浏览器场景通过，静态产物与已有文件完全一致。
- 第 2 次：`internal_error`；摘要为 `bundle upload failed (502)`。
- 第 3 次：`runtime_error` / `machine`；再次是 `the task produced no changes`，报告构建和 33 单测通过，导出产物完全一致；浏览器检查缺少系统库。

这些日志说明失败发生在无变化产物的提交及上传阶段；不能将 `runtime_error` 直接理解成游戏在浏览器内崩溃。
平台是否支持后台恢复，需要维护者确认。已阅读公开的 jobs / follow / errors 文档和 capabilities，
未找到面向请求者的原任务免费重试入口；公开的 `job.continue` 是新的付费请求，价格仍为 0.5 IMD，未发起。

下一步应请求 IMD 恢复原任务的导入节点、接受可验证的无变化构建结果，并继续复核及处理并发风险。
[恢复请求草稿](imd-recovery-request.md) 已准备，尚未发送。原站未部署本次产物。

公开 bundle 和两个临时诊断脚本已保存在本机仓库外：
`/Users/syskey/.local/share/squeek-puzzle/imd/3075901d-fa05-4596-b659-1ada4de7dc49/`。
其中 `diagnostics/README.md` 说明复现方式，避免临时目录清理后丢失证据。
