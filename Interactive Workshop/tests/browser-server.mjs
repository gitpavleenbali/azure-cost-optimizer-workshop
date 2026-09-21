import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";

const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "aco-workshop-browser-"),
);
const service = createApp({
  dataDir: directory,
  origin: "http://127.0.0.1:4397",
});
const server = service.app.listen(4397, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      service.close();
      fs.rmSync(directory, { recursive: true, force: true });
      process.exit(0);
    }),
  );
