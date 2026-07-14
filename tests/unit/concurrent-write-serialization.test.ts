import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock the child_process module BEFORE importing OmniAutomation so the
// class picks up the mocked `spawn`. This lets us observe how many fake
// "osascript" processes are in flight at any instant, and in what order
// they complete, without needing a real OmniFocus.app / osascript.
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { OmniAutomation } from '../../src/omnifocus/OmniAutomation';

interface FakeProc extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: (data: string) => void; end: () => void };
}

interface ActiveRef {
  count: number;
  max: number;
}

/**
 * Builds a fake `spawn` implementation. Each invocation increments an active
 * counter (tracking overlap), schedules a `close` event after `delayMs`, and
 * decrements the counter right before emitting `close`. The script text is
 * captured via `stdin.write` so tests can identify which logical call
 * completed (via a `MARKER:<label>` comment embedded in the script) and in
 * what order. A script containing the literal string `FORCE_REJECT` causes
 * the fake process to close with a non-zero exit code, simulating a failed
 * write.
 */
function makeFakeSpawn(activeRef: ActiveRef, order: string[], delayMs = 15) {
  return vi.fn((_cmd: string, _args: readonly string[]) => {
    const proc = new EventEmitter() as FakeProc;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();

    let capturedScript = '';
    proc.stdin = {
      write: (data: string) => {
        capturedScript += data;
      },
      end: () => {},
    };

    activeRef.count++;
    activeRef.max = Math.max(activeRef.max, activeRef.count);

    setTimeout(() => {
      activeRef.count--;

      const match = capturedScript.match(/MARKER:(\S+)/);
      const label = match ? match[1] : 'unknown';
      order.push(label);

      if (capturedScript.includes('FORCE_REJECT')) {
        proc.emit('close', 1);
      } else {
        proc.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, label })));
        proc.emit('close', 0);
      }
    }, delayMs);

    return proc as unknown as ReturnType<typeof spawn>;
  });
}

describe('OmniAutomation write serialization (concurrent osascript races)', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it('never has more than one write child process active at any instant', async () => {
    const activeRef: ActiveRef = { count: 0, max: 0 };
    const order: string[] = [];
    // Vary delays so a naive unserialized implementation would very likely
    // reorder or overlap completions if writes were not queued.
    const delays: Record<string, number> = { A: 30, B: 5, C: 20, D: 10 };

    const omni = new OmniAutomation();
    const labels = ['A', 'B', 'C', 'D'];

    // Build one fake-spawn call per script, each with its own delay, all
    // sharing the same activeRef/order so overlap is observable globally.
    let callIndex = 0;
    vi.mocked(spawn).mockImplementation((_cmd: any, _args: any) => {
      const label = labels[callIndex++];
      const proc = new EventEmitter() as FakeProc;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      let capturedScript = '';
      proc.stdin = {
        write: (data: string) => {
          capturedScript += data;
        },
        end: () => {},
      };

      activeRef.count++;
      activeRef.max = Math.max(activeRef.max, activeRef.count);

      setTimeout(() => {
        activeRef.count--;
        order.push(label);
        proc.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, label })));
        proc.emit('close', 0);
      }, delays[label]);

      return proc as unknown as ReturnType<typeof spawn>;
    });

    const scripts = labels.map((label) => `/* MARKER:${label} */ return JSON.stringify({ ok: true });`);

    await Promise.all(scripts.map((s) => omni.executeWrite(s)));

    expect(activeRef.max).toBe(1);
  });

  it('completes queued writes in FIFO (enqueue) order regardless of per-call delay', async () => {
    const activeRef: ActiveRef = { count: 0, max: 0 };
    const order: string[] = [];
    const labels = ['first', 'second', 'third'];
    // Deliberately give the first-enqueued write the LONGEST delay: if the
    // implementation were not serialized (or serialized incorrectly), a
    // faster later write could finish first.
    const delays: Record<string, number> = { first: 40, second: 5, third: 5 };

    let callIndex = 0;
    vi.mocked(spawn).mockImplementation((_cmd: any, _args: any) => {
      const label = labels[callIndex++];
      const proc = new EventEmitter() as FakeProc;
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      let capturedScript = '';
      proc.stdin = {
        write: (data: string) => {
          capturedScript += data;
        },
        end: () => {},
      };

      activeRef.count++;
      activeRef.max = Math.max(activeRef.max, activeRef.count);

      setTimeout(() => {
        activeRef.count--;
        order.push(label);
        proc.stdout.emit('data', Buffer.from(JSON.stringify({ success: true, label })));
        proc.emit('close', 0);
      }, delays[label]);

      return proc as unknown as ReturnType<typeof spawn>;
    });

    const omni = new OmniAutomation();
    const scripts = labels.map((label) => `/* MARKER:${label} */`);

    await Promise.all(scripts.map((s) => omni.executeWrite(s)));

    expect(order).toEqual(['first', 'second', 'third']);
    // Confirms this is a genuine serialization effect, not an accident of
    // fast completions: if writes ran concurrently, 'second'/'third' (5ms)
    // would finish well before 'first' (40ms).
    expect(activeRef.max).toBe(1);
  });

  it('does not let a rejected write block subsequently queued writes', async () => {
    const activeRef: ActiveRef = { count: 0, max: 0 };
    const order: string[] = [];
    vi.mocked(spawn).mockImplementation(makeFakeSpawn(activeRef, order, 10));

    const omni = new OmniAutomation();

    const p1 = omni.executeWrite('/* MARKER:ok1 */');
    const p2 = omni.executeWrite('/* MARKER:fail */ FORCE_REJECT').catch((err) => ({ caught: true, err }));
    const p3 = omni.executeWrite('/* MARKER:ok2 */');

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect((r1 as any).success).toBe(true);
    expect((r2 as any).caught).toBe(true);
    expect((r3 as any).success).toBe(true);
    // The failing write still ran in its enqueued position, and the write
    // after it was not starved by the rejection.
    expect(order).toEqual(['ok1', 'fail', 'ok2']);
  });

  it('allows concurrent reads (execute) to overlap — reads are not forced through the write queue', async () => {
    const activeRef: ActiveRef = { count: 0, max: 0 };
    const order: string[] = [];
    vi.mocked(spawn).mockImplementation(makeFakeSpawn(activeRef, order, 30));

    const omni = new OmniAutomation();

    await Promise.all([
      omni.execute('/* MARKER:readA */'),
      omni.execute('/* MARKER:readB */'),
    ]);

    // Both reads should have been in flight at the same time at some point.
    expect(activeRef.max).toBeGreaterThanOrEqual(2);
  });

  it('does not serialize reads even while a write is queued (sanity check on independence)', async () => {
    const activeRef: ActiveRef = { count: 0, max: 0 };
    const order: string[] = [];
    vi.mocked(spawn).mockImplementation(makeFakeSpawn(activeRef, order, 20));

    const omni = new OmniAutomation();

    // Fire one write and two reads concurrently. The two reads should be
    // able to overlap each other (and may overlap the write, since only
    // writes are queued against each other).
    await Promise.all([
      omni.executeWrite('/* MARKER:write1 */'),
      omni.execute('/* MARKER:read1 */'),
      omni.execute('/* MARKER:read2 */'),
    ]);

    expect(activeRef.max).toBeGreaterThanOrEqual(2);
  });
});
