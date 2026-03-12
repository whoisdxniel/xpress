import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { getMyProfileController, updateMyProfileController } from "./profile.controller";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/me", getMyProfileController);
profileRouter.patch("/me", updateMyProfileController);
