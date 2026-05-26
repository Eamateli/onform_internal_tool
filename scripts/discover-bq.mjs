// One-off (re-runnable) BigQuery warehouse introspection.
//
// Why this exists:
//   When wiring a new table into the app, we need to know its exact name and
//   columns. Asking Google's UI is fine for a human but a script is faster
//   and keeps a record of "what was here at time X". Re-run any time you
//   suspect schema drift.
//
// Run with:
//   node scripts/discover-bq.mjs
//   node scripts/discover-bq.mjs --sample 3      # also prints 3 sample rows per table
//
// Does not call any BigQuery write API. Service account only has Data Viewer
// + Job User so it physically couldn't write anyway.

import { config } from "dotenv";
config({ path: ".env.local" });

import { BigQuery } from "@google-cloud/bigquery";

const credsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!credsRaw) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set in .env.local");
  process.exit(1);
}

const projectId = process.env.GOOGLE_PROJECT_ID;
if (!projectId) {
  console.error("GOOGLE_PROJECT_ID is not set in .env.local");
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(credsRaw);
} catch (err) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON:", err.message);
  process.exit(1);
}

const args = process.argv.slice(2);
const sampleIdx = args.indexOf("--sample");
const sampleSize =
  sampleIdx >= 0 && args[sampleIdx + 1] ? Number(args[sampleIdx + 1]) : 0;

const bq = new BigQuery({ projectId, credentials });

console.log(`\nProject: ${projectId}`);
console.log(`Service account: ${credentials.client_email}\n`);

const [datasets] = await bq.getDatasets();

if (datasets.length === 0) {
  console.log("(no datasets visible to this service account)");
  process.exit(0);
}

for (const ds of datasets) {
  console.log(`Dataset: ${ds.id}`);
  const [tables] = await ds.getTables();

  if (tables.length === 0) {
    console.log("  (empty)\n");
    continue;
  }

  for (const t of tables) {
    const [metadata] = await t.getMetadata();
    const rowCount = metadata.numRows ?? "?";
    const kind =
      metadata.type === "VIEW"
        ? "VIEW"
        : metadata.type === "MATERIALIZED_VIEW"
          ? "MAT_VIEW"
          : "TABLE";
    console.log(`  ${kind}: ${t.id}  (rows: ${rowCount})`);

    const fields = metadata.schema?.fields ?? [];
    for (const f of fields) {
      const mode = f.mode && f.mode !== "NULLABLE" ? ` ${f.mode}` : "";
      console.log(`    - ${f.name}: ${f.type}${mode}`);
    }

    if (sampleSize > 0) {
      try {
        const fqtn = `\`${projectId}.${ds.id}.${t.id}\``;
        const [rows] = await bq.query({
          query: `SELECT * FROM ${fqtn} LIMIT ${sampleSize}`,
          location: metadata.location ?? "EU",
        });
        console.log(`    sample (${rows.length}):`);
        for (const r of rows) {
          console.log("      " + JSON.stringify(r));
        }
      } catch (err) {
        console.log(`    sample failed: ${err.message}`);
      }
    }
    console.log("");
  }
}
