// 文件作用：前端国际化（中英双语）。
//
// 为什么自己写而不是引 i18next / react-intl：
// 这个页面只有两种语言、约 60 条文案，不需要复数规则、日期本地化、命名空间这些能力。
// 自己实现一个 40 行的 Context + 字典，依赖更少、类型更直接（key 写错会编译报错）。
//
// 用法：
//   const { lang, setLang, t } = useI18n();
//   t("submit.button", { moves: 12 })
//
// 约定：
// - 文案里的 {name} 是占位符，由 t() 的第二个参数替换；
// - 文案里的 **文字** 表示需要高亮，用 <Rich text={...} /> 渲染。
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "squeek-puzzle:lang";

// 中文是基准字典：它的 key 集合就是 MessageKey，英文必须一一对应，缺一个就编译不过。
const zh = {
  "app.tagline": "把三颗坚果推回窝里 · 每 8 小时一关",
  "app.howToPlay": "怎么玩",
  "app.configMissing": "还没有配置游戏合约地址。请设置环境变量 VITE_PUZZLE_ADDRESS 后重新构建。",

  "level.progress": "本关进度",
  "level.rounds": "{done}/{total} 轮",
  "level.timeLeft": "· 还需 {duration}",
  "level.loadFailed": "读取关卡失败",
  "level.retry": "重试",
  "level.loading": "正在从链上读取关卡…",
  "level.none": "暂无关卡",

  "controls.moves": "步数",
  "controls.undo": "撤销",
  "controls.reset": "重来",
  "controls.hint": "方向键 / WASD · Z 撤销 · R 重来",

  "submit.instruction": "把三颗坚果全部推进虚线窝，就能提交成绩",
  "submit.connect": "连接钱包后提交",
  "submit.install": "安装钱包后提交",
  "submit.wrongChain": "网络不对，切换后提交",
  "submit.noBetter": "你本关的最佳成绩是 {best} 步，这次 {moves} 步没有更快，不用再花 gas 了。",
  "submit.submitting": "提交中…",
  "submit.button": "提交通关 · {moves} 步",

  "notice.checking": "确认关卡…",
  "notice.levelEnded": "本关已经结束了，刷新后会自动切到新关卡。",
  "notice.waitingWallet": "等待钱包确认…",
  "notice.sent": "交易已发送，等待上链… {hash}",
  "notice.confirmed": "已上链：{moves} 步",
  "notice.rejected": "交易失败：合约拒绝了这次提交。",

  "panel.myScore": "我的成绩",
  "panel.bestThisLevel": "本关最佳",
  "panel.solvers": "本关通关人数",
  "panel.scoreNote": "成绩只记录在链上。同一关可以反复提交，只保留最少步数。",
  "panel.leaderboard": "排行榜",
  "panel.fewestFirst": "步数最少优先",
  "panel.aboutLevel": "关于这一关",
  "panel.seedLine": "· 关卡种子来自 SqueekCore 第 **{round}** 轮结束时的账本位置，在链上生成。",
  "panel.sameLevelLine": "· 全世界同一时间看到同一关，没人能提前知道下一关。",
  "panel.cadenceLine": "· 每 **{n}** 个已认证轮次换关（8 小时），一天三关。",
  "panel.fullRules": "完整规则与合约地址",

  "footer.dataLine":
    "关卡由 SqueekCore 已结算轮次的数据确定性地生成，成绩由合约重放校验。页面不托管任何资金，也不需要授权。",
  "footer.explorer": "区块浏览器",

  "wallet.install": "安装钱包",
  "wallet.switchTo": "切换到 {chain}",
  "wallet.connecting": "连接中…",
  "wallet.connect": "连接钱包",
  "wallet.noProvider": "没有检测到浏览器钱包，请先安装 MetaMask 或其它注入式钱包。",
  "wallet.noProviderShort": "没有检测到浏览器钱包",
  "wallet.connectFailed": "连接钱包失败",
  "wallet.addChainFailed": "添加网络失败",
  "wallet.switchFailed": "切换网络失败",
  "wallet.notConnected": "请先连接钱包",
  "wallet.wrongNetwork": "钱包网络不对，请先切换网络",

  "board.emptyTitle": "暂无关卡",
  "board.emptyHint": "正在从链上读取关卡…",

  "rules.title": "怎么玩",
  "rules.close": "关闭",
  "rules.goal": "把 **三颗坚果** 全部推进 **虚线窝** 里。坚果只能推、不能拉，撞墙或撞到别的坚果就走不动。",
  "rules.controls": "键盘 **方向键 / WASD**，手机上用方向键。走错了可以撤销或重来。",
  "rules.seedTitle": "关卡从哪来",
  "rules.seedBody":
    "每 **48 个已认证轮次**（8 小时）一关，一天三关。关卡种子取自 SqueekCore 在那一轮结束时的账本位置，在合约里确定性地生成——所以全世界同一时间看到的是同一关，而且没人能提前知道下一关长什么样。",
  "rules.scoreTitle": "成绩怎么算",
  "rules.scoreBody":
    "解完后用一笔交易提交整条移动路径，合约会把每一步重放一遍：只要有一步行不通、或者最后坚果没全进窝，交易就会失败。排行榜按 **步数最少** 排，同一关可以反复提交更短的解。",
  "rules.addresses": "合约地址",
  "rules.viewExplorer": "在区块浏览器查看 →",

  "dpad.up": "向上移动",
  "dpad.right": "向右移动",
  "dpad.down": "向下移动",
  "dpad.left": "向左移动",

  "error.cancelled": "你在钱包里取消了这笔交易。",
  "error.unknown": "未知错误",

  "duration.soon": "即将换关",
  "duration.minutes": "约 {n} 分钟",
  "duration.hours": "约 {h} 小时",
  "duration.hoursMinutes": "约 {h} 小时 {m} 分",

  "moves.value": "{moves} 步",
  "leaderboard.empty": "本关还没有人提交。",
  "leaderboard.emptyHint": "第一个解出来的人会出现在这里。",
} as const;

export type MessageKey = keyof typeof zh;

const en: Record<MessageKey, string> = {
  "app.tagline": "Push three nuts into their nests · a new puzzle every 8 hours",
  "app.howToPlay": "How to play",
  "app.configMissing": "Game contract address is not configured. Set VITE_PUZZLE_ADDRESS and rebuild.",

  "level.progress": "Progress",
  "level.rounds": "{done}/{total} rounds",
  "level.timeLeft": "· {duration} left",
  "level.loadFailed": "Failed to load the level",
  "level.retry": "Retry",
  "level.loading": "Reading the level from chain…",
  "level.none": "No level available",

  "controls.moves": "Moves",
  "controls.undo": "Undo",
  "controls.reset": "Reset",
  "controls.hint": "Arrows / WASD · Z undo · R reset",

  "submit.instruction": "Push all three nuts into the dashed nests to submit your score",
  "submit.connect": "Connect a wallet to submit",
  "submit.install": "Install a wallet to submit",
  "submit.wrongChain": "Wrong network — switch to submit",
  "submit.noBetter": "Your best on this level is {best} moves. {moves} isn't faster, so there's no need to spend gas.",
  "submit.submitting": "Submitting…",
  "submit.button": "Submit · {moves} moves",

  "notice.checking": "Checking the level…",
  "notice.levelEnded": "This level has ended. It will switch to the new one automatically.",
  "notice.waitingWallet": "Waiting for your wallet…",
  "notice.sent": "Transaction sent, waiting for confirmation… {hash}",
  "notice.confirmed": "Confirmed: {moves} moves",
  "notice.rejected": "Transaction failed: the contract rejected this submission.",

  "panel.myScore": "My score",
  "panel.bestThisLevel": "Best this level",
  "panel.solvers": "Solvers",
  "panel.scoreNote": "Scores live onchain. You can submit again on the same level; only your fewest moves are kept.",
  "panel.leaderboard": "Leaderboard",
  "panel.fewestFirst": "Fewest moves first",
  "panel.aboutLevel": "About this level",
  "panel.seedLine":
    "· The seed comes from SqueekCore's ledger position at the end of round **{round}**, generated onchain.",
  "panel.sameLevelLine": "· Everyone sees the same level at the same time, and nobody can see the next one early.",
  "panel.cadenceLine": "· A new level every **{n}** certified rounds (8 hours) — three a day.",
  "panel.fullRules": "Full rules & contract addresses",

  "footer.dataLine":
    "Levels are generated deterministically from SqueekCore's settled rounds, and every score is replayed by the contract. This page holds no funds and asks for no approvals.",
  "footer.explorer": "Block explorer",

  "wallet.install": "Install wallet",
  "wallet.switchTo": "Switch to {chain}",
  "wallet.connecting": "Connecting…",
  "wallet.connect": "Connect wallet",
  "wallet.noProvider": "No browser wallet detected. Install MetaMask or another injected wallet first.",
  "wallet.noProviderShort": "No browser wallet detected",
  "wallet.connectFailed": "Failed to connect the wallet",
  "wallet.addChainFailed": "Failed to add the network",
  "wallet.switchFailed": "Failed to switch the network",
  "wallet.notConnected": "Connect your wallet first",
  "wallet.wrongNetwork": "Wrong network — switch it first",

  "board.emptyTitle": "No level available",
  "board.emptyHint": "Reading the level from chain…",

  "rules.title": "How to play",
  "rules.close": "Close",
  "rules.goal":
    "Push all **three nuts** into the **dashed nests**. Nuts can only be pushed, never pulled — walls and other nuts block you.",
  "rules.controls": "Use the **arrow keys / WASD**, or the on-screen pad on mobile. Undo or reset if you get stuck.",
  "rules.seedTitle": "Where the levels come from",
  "rules.seedBody":
    "One level every **48 certified rounds** (8 hours), three a day. The seed comes from SqueekCore's ledger position at the end of that round and is expanded deterministically inside the contract — so everyone sees the same level at the same time, and nobody can see the next one early.",
  "rules.scoreTitle": "How scoring works",
  "rules.scoreBody":
    "When you solve it, one transaction submits your whole move path. The contract replays every step: one blocked move, or any nut left out of its nest, and the transaction fails. The leaderboard ranks by **fewest moves**, and you can resubmit a shorter solution on the same level.",
  "rules.addresses": "Contract addresses",
  "rules.viewExplorer": "View on block explorer →",

  "dpad.up": "Move up",
  "dpad.right": "Move right",
  "dpad.down": "Move down",
  "dpad.left": "Move left",

  "error.cancelled": "You cancelled the transaction in your wallet.",
  "error.unknown": "Unknown error",

  "duration.soon": "about to change",
  "duration.minutes": "about {n} min",
  "duration.hours": "about {h} h",
  "duration.hoursMinutes": "about {h} h {m} min",

  "moves.value": "{moves} moves",
  "leaderboard.empty": "No submissions yet.",
  "leaderboard.emptyHint": "The first solver will show up here.",
};

const DICTS: Record<Lang, Record<MessageKey, string>> = { zh, en };

export type TFunc = (key: MessageKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunc;
}

const I18nContext = createContext<I18nValue | null>(null);

/** 占位符替换：{name} -> vars.name */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] === undefined ? match : String(vars[key]),
  );
}

/** 语言检测顺序：本地记忆 > 浏览器语言 > 中文 */
function detectLang(): Lang {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") return stored;
  } catch {
    // 隐私模式下 localStorage 可能抛错，忽略即可
  }
  const nav = window.navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 存不了就算了，不影响本次会话
    }
  }, []);

  // 同步 <html lang> 与页面标题，方便无障碍工具和浏览器标签页
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title =
      lang === "zh" ? "SQUEK PUZZLE · 仓鼠推坚果" : "SQUEK PUZZLE · Hamster Nut Push";
  }, [lang]);

  const t = useCallback<TFunc>(
    (key, vars) => interpolate(DICTS[lang][key] ?? DICTS.zh[key] ?? key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n 必须在 <I18nProvider> 内使用");
  return ctx;
}
