import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  // Reuse the connection across HMR reloads in dev.
  var __hqSql: ReturnType<typeof postgres> | undefined;
}

const sql =
  globalThis.__hqSql ??
  postgres(process.env.DATABASE_URL!, {
    max: 10,
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalThis.__hqSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
