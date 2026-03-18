import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware";
import { requireRole } from "../../middlewares/role.middleware";
import {
  adminGetAppConfigController,
  adminUpdateAppConfigController,
  adminApproveDriverController,
  adminHardDeleteDriverController,
  adminCreateDriverController,
  adminAssignRideDriverController,
  adminCreateAddonController,
  adminDeleteAddonController,
  adminGetDriverCreditsController,
  adminAdjustDriverCreditsController,
  adminSetDriverActiveController,
  adminUpdateDriverController,
  adminGetMetricsController,
  adminListAddonsController,
  adminListDriversController,
  adminListPassengersController,
  adminSetPassengerActiveController,
  adminUpdatePassengerController,
  adminDeletePassengerController,
  adminListRatingsController,
  adminListRidesController,
  adminUpdateAddonController,
  adminUpsertPricingController,
  adminGetPricingController,
} from "./admin.controller";
import { passwordResetsAdminRouter } from "./passwordResets.routes";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(["ADMIN"]));

adminRouter.post("/drivers", adminCreateDriverController);
adminRouter.get("/drivers", adminListDriversController);
adminRouter.patch("/drivers/:driverId/status", adminApproveDriverController);
adminRouter.delete("/drivers/:driverId", adminHardDeleteDriverController);
adminRouter.patch("/drivers/:driverId", adminUpdateDriverController);
adminRouter.patch("/drivers/:driverId/active", adminSetDriverActiveController);
adminRouter.get("/drivers/:driverId/credits", adminGetDriverCreditsController);
adminRouter.patch("/drivers/:driverId/credits", adminAdjustDriverCreditsController);

adminRouter.get("/passengers", adminListPassengersController);
adminRouter.patch("/passengers/:passengerId", adminUpdatePassengerController);
adminRouter.patch("/passengers/:passengerId/active", adminSetPassengerActiveController);
adminRouter.delete("/passengers/:passengerId", adminDeletePassengerController);
adminRouter.get("/rides", adminListRidesController);
adminRouter.post("/rides/:rideId/assign-driver", adminAssignRideDriverController);
adminRouter.get("/ratings", adminListRatingsController);

adminRouter.get("/pricing", adminGetPricingController);
adminRouter.put("/pricing/:serviceType", adminUpsertPricingController);

adminRouter.get("/app-config", adminGetAppConfigController);
adminRouter.put("/app-config", adminUpdateAppConfigController);

adminRouter.get("/addons", adminListAddonsController);
adminRouter.post("/addons", adminCreateAddonController);
adminRouter.patch("/addons/:addonId", adminUpdateAddonController);
adminRouter.delete("/addons/:addonId", adminDeleteAddonController);

adminRouter.get("/metrics", adminGetMetricsController);

adminRouter.use(passwordResetsAdminRouter);
