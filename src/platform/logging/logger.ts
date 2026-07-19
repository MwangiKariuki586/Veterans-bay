export type LogLevel = "info" | "error";

export interface SafeLogEntry {
  level: LogLevel;
  event: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  errorCategory?: string;
  issues?: Array<{ path: string; code: string }>;
}

function write(entry: SafeLogEntry): void {
  console.log({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

export function logInfo(entry: Omit<SafeLogEntry, "level">): void {
  write({ ...entry, level: "info" });
}

export function logError(entry: Omit<SafeLogEntry, "level">): void {
  write({ ...entry, level: "error" });
}
