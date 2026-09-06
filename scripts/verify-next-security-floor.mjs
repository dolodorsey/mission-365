import { readFileSync } from 'node:fs';

const FLOOR = [16, 3, 3];
const FLOOR_TEXT = FLOOR.join('.');

function parseVersion(input, label) {
  const value = String(input ?? '').trim().replace(/^[~^<>=\s]*/, '');
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`${label} must resolve to a concrete semver version; received ${JSON.stringify(input)}`);
  }
  return match.slice(1, 4).map(Number);
}

function gte(version, floor) {
  for (let i = 0; i < 3; i += 1) {
    if (version[i] > floor[i]) return true;
    if (version[i] < floor[i]) return false;
  }
  return true;
}

function assertFloor(value, label) {
  const parsed = parseVersion(value, label);
  if (!gte(parsed, FLOOR)) {
    throw new Error(`${label}=${value} is below the Mission 365 Next.js security floor ${FLOOR_TEXT}`);
  }
}

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

const declaredNext = pkg.dependencies?.next;
const declaredEslintNext = pkg.devDependencies?.['eslint-config-next'];
const resolvedNext = lock.packages?.['node_modules/next']?.version;
const resolvedEslintNext = lock.packages?.['node_modules/eslint-config-next']?.version;

assertFloor(declaredNext, 'package.json dependencies.next');
assertFloor(declaredEslintNext, 'package.json devDependencies.eslint-config-next');
assertFloor(resolvedNext, 'package-lock.json node_modules/next');
assertFloor(resolvedEslintNext, 'package-lock.json node_modules/eslint-config-next');

if (parseVersion(declaredNext, 'declared next').join('.') !== parseVersion(resolvedNext, 'resolved next').join('.')) {
  throw new Error(`Mission 365 Next.js declaration/resolution mismatch: declared=${declaredNext} resolved=${resolvedNext}`);
}

if (parseVersion(declaredEslintNext, 'declared eslint-config-next').join('.') !== parseVersion(resolvedEslintNext, 'resolved eslint-config-next').join('.')) {
  throw new Error(`Mission 365 eslint-config-next declaration/resolution mismatch: declared=${declaredEslintNext} resolved=${resolvedEslintNext}`);
}

console.log(`Mission 365 Next.js security floor verified: next=${resolvedNext}, eslint-config-next=${resolvedEslintNext}, floor=${FLOOR_TEXT}`);
