// 文件作用：为 IMD 等从仓库根目录构建的托管平台提供静态网站入口。
// 核心流程：按 web/package-lock.json 安装依赖、构建 web/，再将产物复制到根目录 dist/。
// 前后端目录保持独立；此脚本不访问钱包、不签名，也不部署任何合约。
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const web = fileURLToPath(new URL("../web/", import.meta.url));
const source = fileURLToPath(new URL("../web/dist/", import.meta.url));
const target = fileURLToPath(new URL("../dist/", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  // 即使托管环境设置 NODE_ENV=production，也要安装构建所需的 Vite、TypeScript 等开发依赖。
  execFileSync(npm, ["ci", "--include=dev"], { cwd: web, stdio: "inherit" });
  execFileSync(npm, ["run", "build"], { cwd: web, stdio: "inherit" });

  // 只有构建成功且入口存在时才替换根目录产物，避免复制空目录并误报成功。
  if (!existsSync(new URL("../web/dist/index.html", import.meta.url))) {
    throw new Error("前端构建没有生成 dist/index.html");
  }
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  console.log(`静态网站已生成：${root}dist/`);
} catch (error) {
  // 安装、编译或复制失败时返回非零状态，让远端托管平台明确停止发布。
  console.error("网站构建失败：", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
