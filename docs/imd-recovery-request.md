# IMD 原任务恢复请求草稿

以下内容供发送给 IMD 维护者；当前仅保存草稿，尚未发送。
本请求旨在恢复已经付款的原任务，不请求创建新的付费任务。

## English draft

Please investigate and resume the existing paid job:

- Job: `3075901d-fa05-4596-b659-1ada4de7dc49`
- Explorer: <https://explorer.imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49>
- Ethereum payment: `0x271193f4599cb83d9d2f6b97e586ca25847eb3a8607f732acea9d4c25d29b2cf`
- Current state: `blocked`, `node import_site: runtime_error`, `complete=false`.
- Revised build accepted at commit `7b0829e65ce45ca0885986e483fbde6c59e55a38`.
- Source bundle SHA-256: `7ec48d93a23b5f930491839174f0386e57a86aefcda5834586874b497fcd8fb0`.
- Failure time: `2026-10-30T13:06:11.630Z`.

The revision's import step exhausted three attempts:

1. `runtime_error`: “the task produced no changes,” even though its summary reports a successful build, 33 unit tests and 22 browser scenarios, with the export matching the already tracked build.
2. `internal_error`: “bundle upload failed (502).”
3. `runtime_error`: “the task produced no changes” again, with a successful build and 33 unit tests. Browser verification on that worker was unavailable because of missing system libraries.

We independently rebuilt the accepted source. All 13 submitted export files match the rebuilt export byte for byte (688,913 bytes total). The 33 unit tests and 23 Chromium scenarios, including a read-only live Sepolia check, pass. A valid no-change rebuild appears unable to progress through `import_site`; please inspect that handling and recover the existing paid job so reviews and GitHub/IPFS delivery can continue.

There is also an unresolved medium finding from `site_content_check` that we independently reproduced twice on the accepted revision: when localStorage writes fail, a late old `board()` response can roll the UI back after a newer puzzle was fetched, erasing the newer puzzle's in-memory moves. Please include it in the resumed revision/review. We also recorded a WebKit pointer-open dialog focus-return limitation; keyboard-open focus return works.

Please confirm whether you can recover the original job without a second payment. We are not authorizing a new paid continuation. No production deployment or new contract transaction is requested.

Public attempt records: <https://api.imd.fun/jobs/3075901d-fa05-4596-b659-1ada4de7dc49/submissions>

Local verification and filtered public failure evidence:
<https://github.com/skyMetaverse/squeek-puzzle/blob/main/docs/imd-review-progress.md>
<https://github.com/skyMetaverse/squeek-puzzle/blob/main/docs/imd-status-evidence.json>
