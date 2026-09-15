import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import { config } from "dotenv";

config();

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL?.replace("file:", "") || "kikfit.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);
