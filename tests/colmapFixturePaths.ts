import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const COLMAP_BICYCLE_FIXTURE_ENV = 'COLMAP_BICYCLE_FIXTURE_DIR';

// Fixture suites parse/serialize the whole bicycle reconstruction (~1.5s idle);
// the 5s default has no headroom once the rest of the run is loading in parallel.
export const FIXTURE_SUITE_TIMEOUT_MS = 15000;

export function getBicycleFixtureDir(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env[COLMAP_BICYCLE_FIXTURE_ENV] ?? resolve(cwd, '..', '360_v2', 'bicycle', 'sparse', '0');
}

export function hasSparseBinaryFixture(dir: string): boolean {
  return existsSync(resolve(dir, 'cameras.bin'))
    && existsSync(resolve(dir, 'images.bin'))
    && existsSync(resolve(dir, 'points3D.bin'));
}
