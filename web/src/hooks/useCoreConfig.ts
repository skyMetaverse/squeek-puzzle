// 文件作用：读取 SqueekCore 的配置（目前只用轮长），用于把"还剩几轮"换算成时间。
// 读取失败时退回文档里的启动配置（600 秒/轮），并标记来源，避免界面显示成 0。
import { useEffect, useState } from "react";
import { coreAbi } from "../lib/abi";
import { publicClient } from "../lib/client";
import { CORE_ADDRESS } from "../lib/config";

const FALLBACK_ROUND_SECONDS = 600;

export function useRoundSeconds(): number {
  const [seconds, setSeconds] = useState(FALLBACK_ROUND_SECONDS);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const config = await publicClient.readContract({
          address: CORE_ADDRESS,
          abi: coreAbi,
          functionName: "configuration",
        });
        const roundDuration = Number(config[2]);
        if (!cancelled && Number.isFinite(roundDuration) && roundDuration > 0) {
          setSeconds(roundDuration);
        }
      } catch {
        // 读不到就用文档里的默认值，不影响主流程
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return seconds;
}
