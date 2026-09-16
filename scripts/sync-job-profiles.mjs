import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Server JSON is canonical; the web snapshot enables JD editing before the server is running.
const serverRoot = process.argv[2];
if (!serverRoot)
  throw new Error('Usage: node scripts/sync-job-profiles.mjs <server-repo> [--check]');
const source = resolve(serverRoot, 'src/main/resources/analysis/job-profiles.json');
const destination = new URL('../data/evaluation/job-profiles.json', import.meta.url);
const contents = await readFile(source, 'utf8');
const catalog = JSON.parse(contents);
if (
  catalog.profiles.length !== 12 ||
  catalog.profiles.some((p) => p.criteria.reduce((s, c) => s + c.weight, 0) !== 100)
)
  throw new Error('Invalid job profile catalog');
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(await readFile(destination, 'utf8'))) !== JSON.stringify(catalog))
    throw new Error('Web and server job profiles differ; sync the catalog and update its version.');
  console.log(`Catalog synchronized: ${catalog.version}, ${catalog.profiles.length} profiles`);
} else {
  await writeFile(destination, contents);
  console.log(`Updated web catalog: ${catalog.version}`);
}
