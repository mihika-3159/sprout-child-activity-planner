import fs from "node:fs";

const databasePath = process.env.DATABASE_PATH;

if (databasePath) {
  fs.writeFileSync(databasePath, "{}", "utf8");
}
