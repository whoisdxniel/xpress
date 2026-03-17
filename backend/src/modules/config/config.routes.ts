import { Router } from "express";
import { getPublicAppConfigController } from "./config.controller";

export const configRouter = Router();

// Público: no requiere auth (tasas/ajustes no son sensibles).
configRouter.get("/app", getPublicAppConfigController);
