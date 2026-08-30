import { describe, expect, it } from 'vitest';
import { readRootTokens, resolveValueToPixels } from './cssRootTokens';

describe('cssRootTokens', () => {
  const tokens = readRootTokens();

  it('reads a full token map out of index.css', () => {
    expect(tokens.size).toBeGreaterThan(50);
    expect(tokens.get('--sp-4')).toBeDefined();
    expect(tokens.get('--sp-1.5')).toBeDefined(); // escaped name resolved
  });

  it('resolves px, rem, zero, and var() chains to pixels', () => {
    expect(resolveValueToPixels(tokens, '16px')).toBe(16);
    expect(resolveValueToPixels(tokens, '1rem')).toBe(16);
    expect(resolveValueToPixels(tokens, '0')).toBe(0);
    expect(resolveValueToPixels(tokens, 'var(--sp-4)')).toBe(
      resolveValueToPixels(tokens, tokens.get('--sp-4')!)
    );
  });

  it('throws on unresolvable values instead of returning NaN', () => {
    // A silent NaN made classContract's old rootLadder() quietly vacuous for
    // any rung it could not parse; the shared parser refuses instead.
    expect(() => resolveValueToPixels(tokens, 'calc(1px + 1px)')).toThrow();
    expect(() => resolveValueToPixels(tokens, 'var(--does-not-exist)')).toThrow();
  });
});
