import { invoke, isTauri } from "@tauri-apps/api/core";

export type AppUpdateOffer = {
  version: string;
  tag: string;
};

export type AppUpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "installing"; version: string; downloadedBytes: number; contentLength?: number }
  | { kind: "error"; message: string; expected?: boolean };

export function canUpdateApp(): boolean {
  return isTauri();
}

export async function findAppUpdate(): Promise<AppUpdateOffer | null> {
  if (!canUpdateApp()) return null;
  return invoke<AppUpdateOffer | null>("check_app_update");
}

export async function installAppUpdate(): Promise<void> {
  await invoke("install_app_update");
}

export function describeUpdateError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Could not check for updates.";
}

export function isMissingPublishedRelease(error: unknown): boolean {
  return /valid release JSON|404|not found|No published release/i.test(describeUpdateError(error));
}
