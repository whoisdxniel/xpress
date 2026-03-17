import { apiRequest } from "../lib/api";

export type PublicAppConfig = {
  id: string;
  fxCopPerUsd: number;
  fxCopPerVes: number;
};

export function apiGetPublicAppConfig() {
  return apiRequest<{ ok: true; appConfig: PublicAppConfig }>({
    method: "GET",
    path: "/config/app",
  });
}
