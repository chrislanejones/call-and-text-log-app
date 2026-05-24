import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "..", "data", "data.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function open() {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma("journal_mode = WAL");
  db.pragma("query_only = true");
  return db;
}

export function getDb(): Database.Database {
  if (!global.__db) global.__db = open();
  return global.__db;
}

export const IMAGES_DIR = path.resolve(process.cwd(), "..", "data", "mms");
