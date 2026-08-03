export function assertLocalSeedEnvironment(env, confirmed) {
  if (!confirmed) throw new Error("Pass --confirm-local to seed the local dashboard scenario.");
  if (env.APP_ENV !== "development") throw new Error("Local dashboard seed requires APP_ENV=development.");
  for (const key of ["WEB_ORIGIN", "BETTER_AUTH_URL"]) {
    const value = env[key]?.trim();
    if (!value) throw new Error(`${key} is required for the local dashboard seed.`);
    const hostname = new URL(value).hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]") throw new Error(`${key} must use a localhost origin.`);
  }
  if (!env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required for the local dashboard seed.");
}
