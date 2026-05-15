#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const payloadPath = process.argv[2];
if (!payloadPath || !existsSync(payloadPath)) {
  console.error("Usage: node scripts/facture-revolution-from-json.mjs ./invoice-payload.json");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
const factureScript = join(homedir(), ".local/bin/facture.py");

const args = [
  factureScript,
  "--client", payload.client,
  "--siret", payload.siret ?? "",
  "--form", payload.form ?? "",
  "--address", payload.address,
  "--num", payload.num,
];

for (const service of payload.services ?? []) {
  const amount = Number(service.amount ?? 0);
  const discount = Number(service.discount ?? 0);
  const total = Number(service.total ?? amount - discount);
  args.push("--service", `${service.name}|${service.detail}|${amount}|${discount || "-"}|${total}`);
}

const result = spawnSync("python3", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
