import type { Request, Response } from "express";
import { getAppConfig } from "./appConfig.service";
import { prisma } from "../../db/prisma";

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

export async function getPublicZonesController(_req: Request, res: Response) {
  const zones = await prisma.zone.findMany({
    where: { isActive: true },
    orderBy: [{ isHub: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isHub: true,
      geojson: true,
    },
  });

  return res.json({ ok: true as const, zones });
}
