# IMD 初步交付验证记录

任务：<https://explorer.imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49>

当前阶段：平台仍为 `executing`，`build_website` / `import_site` 节点已接受，
`design_critic` / `site_content_check` 尚在复核。该记录不代表任务已正式交付。

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

## 尚待平台复核的问题

平台 `design_critic` 在 `2026-10-30T12:38:44.418Z` 的活动说明中提到：

1. RPC 错误文字可能使 390px 手机页面产生横向溢出。
2. 规则弹窗打开时，后台轮询可能将键盘焦点重置到关闭按钮。
3. 通关后未安装钱包时，“安装钱包”操作可能只展示错误。

以上是平台尚未终审的复核发现，不将其表述为已修复或已最终判定。
平台下一轮可能修正源码、更新 bundle 或生成新的提交；届时必须重新核对最终提交与交付结果，
不能直接把本初版的验证结果当成后续版本的证明。

IMD 的节点 `accepted` 当前是结构验收，平台注明未为该类节点运行测试套件；
本文件中的测试数字来自本地独立复跑。源码包已出现不等于 `delivery.commit` 已生成。
