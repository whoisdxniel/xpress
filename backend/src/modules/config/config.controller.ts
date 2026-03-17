import type { Request, Response } from "express";
import { getAppConfig } from "./appConfig.service";

export async function getPublicAppConfigController(_req: Request, res: Response) {
  const cfg = await getAppConfig();

  return res.json({
    ok: true as const,
    appConfig: {
      id: cfg.id,
      fxCopPerUsd: Number((cfg as any).fxCopPerUsd ?? 0),
      fxCopPerVes: Number((cfg as any).fxCopPerVes ?? 0),
    },
  });
}
