import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

const minimum = [16, 3, 3];
const minimumLabel = minimum.join('.');

function parseVersion(value, label) {
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing or is not a string`);
  }
  const match = value.match(/^(?:\^|~|>=|>|=)?\s*(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`${label} has an unsupported version expression: ${value}`);
  }
  return match.slice(1, 4).map(Number);
}

function gte(actual, floor) {
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] > floor[index]) return true;
    if (actual[index] < floor[index]) return false;
  }
  return true;
}

function assertFloor(value, label) {
  const parsed = parseVersion(value, label);
  if (!gte(parsed, minimum)) {
    throw new Error(`${label}=${value} is below the Mission 365 security floor ${minimumLabel}`);
  }
}

const checks = {
  'package.json next': packageJson.dependencies?.next,
  'package-lock next': packageLock.packages?.['node_modules/next']?.version,
  'package.json eslint-config-next': packageJson.devDependencies?.['eslint-config-next'],
  'package-lock eslint-config-next': packageLock.packages?.['node_modules/eslint-config-next']?.version,
};

const failures = [];
for (const [label, value] of Object.entries(checks)) {
  try {
    assertFloor(value, label);
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  console.error('Mission 365 Next.js security-floor verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Mission 365 Next.js security floor satisfied (>=${minimumLabel}).`);
console.log(`next=${checks['package-lock next']}; eslint-config-next=${checks['package-lock eslint-config-next']}`);
