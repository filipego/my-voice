import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

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

export async function findAppUpdate(): Promise<Update | null> {
  if (!canUpdateApp()) return null;
  return check({ timeout: 15_000 });
}

export async function installAppUpdate(
  update: Update,
  onProgress: (event: DownloadEvent) => void,
): Promise<void> {
  await update.downloadAndInstall(onProgress, { timeout: 120_000 });
  await relaunch();
}

export function describeUpdateError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Could not check for updates.";
}

export function isMissingPublishedRelease(error: unknown): boolean {
  return /valid release JSON|404|not found/i.test(describeUpdateError(error));
}
