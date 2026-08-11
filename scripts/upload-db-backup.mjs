#!/usr/bin/env node
// Uploads an encrypted database dump to the project's Vercel Blob store.
// Rotation is name-based, so there is no prune job to maintain:
//   db-backups/daily-<mon..sun>.dump.enc   — 7-day rolling window
//   db-backups/monthly-<01..12>.dump.enc   — 12-month rolling window (1st only)
// The file is AES-encrypted BEFORE it reaches this script (see the workflow);
// blob URLs are unguessable but treated as public — nothing readable ships.
import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const file = process.argv[2];
if (!file) {
  console.error("usage: upload-db-backup.mjs <encrypted-dump-file>");
  process.exit(1);
}

const body = readFileSync(file);
if (body.length < 1024) {
  // An empty/near-empty dump means pg_dump failed upstream — refuse to
  // overwrite a good rotation slot with garbage.
  console.error(`refusing to upload ${body.length}-byte dump`);
  process.exit(1);
}

const day = new Date().toUTCString().slice(0, 3).toLowerCase();
const targets = [`db-backups/daily-${day}.dump.enc`];
const utcDate = new Date().getUTCDate();
if (utcDate === 1) {
  const month = String(new Date().getUTCMonth() + 1).padStart(2, "0");
  targets.push(`db-backups/monthly-${month}.dump.enc`);
}

for (const pathname of targets) {
  const blob = await put(pathname, body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true
  });
  console.log(`uploaded ${pathname} (${body.length} bytes) -> ${blob.pathname}`);
}
