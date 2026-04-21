/**
 * Regression tests for the CSP-safe Web Worker script builder in httpClient.ts.
 *
 * The original implementation used `new Function('fetchy', 'console', script)`
 * inside the worker blob, which is eval-equivalent and blocked by the app's
 * Content-Security-Policy (`script-src 'self' blob:` without `unsafe-eval`).
 *
 * The fix replaces that pattern with `buildWorkerSource(userScript)`, which
 * embeds the user script as a literal IIFE in the blob source string.  The
 * blob is allowed by `script-src blob:` without needing `unsafe-eval`.
 *
 * These tests verify:
 *   1. The generated source never uses `new Function` or `eval`.
 *   2. The user script text is embedded verbatim (not dynamically executed).
 *   3. The IIFE wrapper and messaging boilerplate are present.
 *
 * Note: We test the source string only — Worker / Blob APIs are not available
 * in the Node test environment and are not needed to verify CSP safety.
 */
import { describe, it, expect } from 'vitest';
import { buildWorkerSource } from '../src/utils/httpClient';

describe('buildWorkerSource (CSP-safe script embedding)', () => {
  it('does not contain "new Function" in the generated source', () => {
    const src = buildWorkerSource('console.log("hello")');
    expect(src).not.toContain('new Function');
  });

  it('does not contain "eval(" in the generated source', () => {
    const src = buildWorkerSource('console.log("hello")');
    expect(src).not.toContain('eval(');
  });

  it('embeds the user script literally in the output', () => {
    const script = 'var x = fetchy.response.status;';
    const src = buildWorkerSource(script);
    expect(src).toContain(script);
  });

  it('wraps user script in an IIFE with fetchy and console parameters', () => {
    const src = buildWorkerSource('/* user script */');
    expect(src).toContain('(function(fetchy, console) {');
    expect(src).toContain('})(fetchy, _console);');
  });

  it('includes a self.onmessage handler', () => {
    const src = buildWorkerSource('');
    expect(src).toContain('self.onmessage = function');
  });

  it("posts a 'done' message on success", () => {
    const src = buildWorkerSource('');
    expect(src).toContain("postMessage({ type: 'done'");
  });

  it("posts an 'error' message on exception", () => {
    const src = buildWorkerSource('');
    expect(src).toContain("postMessage({ type: 'error'");
  });

  it('embeds multi-line scripts intact without transformation', () => {
    const script = 'if (fetchy.response.status === 200) {\n  console.log("ok");\n}';
    const src = buildWorkerSource(script);
    expect(src).toContain(script);
  });

  it('returns a non-empty string for an empty user script', () => {
    const src = buildWorkerSource('');
    expect(typeof src).toBe('string');
    expect(src.length).toBeGreaterThan(0);
  });

  it('each call is independent — different scripts produce different sources', () => {
    const src1 = buildWorkerSource('var a = 1;');
    const src2 = buildWorkerSource('var b = 2;');
    expect(src1).not.toBe(src2);
    expect(src1).toContain('var a = 1;');
    expect(src2).toContain('var b = 2;');
  });

  it('pm.response.body is defined in the generated worker source', () => {
    const src = buildWorkerSource('');
    // Must expose pm.response.body (the parsed JSON data) so Postman-style
    // scripts like `pm.response.body.access_token` work.
    expect(src).toContain('pm.response.body') || expect(src).toContain('body:');
  });

  it('pm.response.body assignment uses fetchy.response.data', () => {
    const src = buildWorkerSource('');
    // The body property on pm.response must be backed by fetchy.response.data
    expect(src).toContain('fetchy.response.data');
  });
});
