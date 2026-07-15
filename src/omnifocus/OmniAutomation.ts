import { spawn } from 'node:child_process';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('omniautomation');

export class OmniAutomationError extends Error {
  constructor(message: string, public readonly script?: string, public readonly stderr?: string) {
    super(message);
    this.name = 'OmniAutomationError';
  }
}

export class OmniAutomation {
  private readonly maxScriptSize = 100000; // 100KB limit for scripts
  private readonly timeout = 90000; // 90 second timeout (1500+ tasks need time)

  // Process-global (static, not per-instance) write serialization. Each tool
  // (CreateTaskTool, UpdateTaskTool, ...) constructs its OWN OmniAutomation
  // instance (see src/tools/base.ts), so instance-level state would only
  // serialize writes within a single tool, not across tools racing against
  // the same OmniFocus document. Static state makes the queue process-wide.
  private static writeQueue: Promise<unknown> = Promise.resolve();

  // Chains write work onto the tail of the queue. Critically, the tail stays
  // alive across rejections — otherwise one failed write would poison the
  // queue and permanently block every write queued after it.
  private static enqueueWrite<T>(work: () => Promise<T>): Promise<T> {
    const run = OmniAutomation.writeQueue.then(work, work); // runs regardless of prior outcome
    OmniAutomation.writeQueue = run.then(() => undefined, () => undefined); // swallow so the chain survives rejection
    return run;
  }

  public async execute<T = any>(script: string): Promise<T> {
    if (script.length > this.maxScriptSize) {
      throw new OmniAutomationError(`Script too large: ${script.length} bytes (max: ${this.maxScriptSize})`);
    }

    return this.executeInternal<T>(script);
  }

  // Serialized variant of execute(), for scripts that mutate OmniFocus state
  // (create/update/delete/complete/tag management). Concurrent mutating calls
  // race against each other inside OmniFocus.app when run through raw
  // execute() — see BUG-concurrent-projectid-move.md. Reads (list/get/count/
  // analytics) should keep using execute() and remain concurrent.
  public async executeWrite<T = any>(script: string): Promise<T> {
    if (script.length > this.maxScriptSize) {
      throw new OmniAutomationError(`Script too large: ${script.length} bytes (max: ${this.maxScriptSize})`);
    }

    return OmniAutomation.enqueueWrite(() => this.executeInternal<T>(script));
  }

  private async executeInternal<T = any>(script: string): Promise<T> {
    const wrappedScript = this.wrapScript(script);
    
    logger.debug('Executing OmniAutomation script', { scriptLength: script.length });

    return new Promise((resolve, reject) => {
      const proc = spawn('osascript', ['-l', 'JavaScript'], {
        timeout: this.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        logger.error('Script execution failed:', error);
        reject(new OmniAutomationError('Failed to execute script', script, error.message));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          logger.error('Script execution failed with code:', code);
          
          
          reject(new OmniAutomationError(`Script execution failed with code ${code}`, script, stderr));
          return;
        }

        if (stderr) {
          logger.warn('Script execution warning:', stderr);
        }

        try {
          const result = JSON.parse(stdout.trim());
          logger.debug('Script execution successful');
          resolve(result);
        } catch (parseError) {
          logger.error('Failed to parse script output:', stdout);
          reject(new OmniAutomationError('Invalid JSON response from script', script, stdout));
        }
      });

      // Write script to stdin
      proc.stdin.write(wrappedScript);
      proc.stdin.end();
    });
  }

  private wrapScript(script: string): string {
    return `(() => {
      try {
        const app = Application('OmniFocus');
        const doc = app.defaultDocument;
        
        ${script}
      } catch (error) {
        return JSON.stringify({
          error: true,
          message: error.toString(),
          stack: error.stack
        });
      }
    })()`;
  }

  // Helper method to build common script patterns
  public buildScript(template: string, params: Record<string, any> = {}): string {
    let script = template;
    
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      const replacement = this.formatValue(value);
      script = script.replace(new RegExp(placeholder, 'g'), replacement);
    }
    
    return script;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      // Escape quotes and special characters in string literals
      return JSON.stringify(value);
    }
    
    if (value instanceof Date) {
      return `new Date("${value.toISOString()}")`;
    }
    
    if (Array.isArray(value)) {
      const items = value.map(v => this.formatValue(v)).join(', ');
      return `[${items}]`;
    }
    
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .map(([k, v]) => `${JSON.stringify(k)}: ${this.formatValue(v)}`)
        .join(', ');
      return `{${entries}}`;
    }
    
    return String(value);
  }

  // Execute OmniFocus automation via URL scheme (for operations requiring higher permissions).
  // Every current caller (Delete/Complete Task/Project tools) uses this path for mutating
  // operations, so it is always routed through the same static write queue as executeWrite().
  public async executeViaUrlScheme<T = any>(script: string): Promise<T> {
    if (script.length > this.maxScriptSize) {
      throw new OmniAutomationError(`Script too large: ${script.length} bytes (max: ${this.maxScriptSize})`);
    }

    return OmniAutomation.enqueueWrite(() => this.executeViaUrlSchemeInternal<T>(script));
  }

  private async executeViaUrlSchemeInternal<T = any>(script: string): Promise<T> {
    // Encode the script for URL scheme execution
    const encodedScript = encodeURIComponent(script);
    const url = `omnifocus:///omnijs-run?script=${encodedScript}`;

    logger.debug('Executing OmniAutomation script via URL scheme', { scriptLength: script.length });

    return new Promise((resolve, reject) => {
      // Use 'open' command to execute URL scheme
      const proc = spawn('open', [url], {
        timeout: this.timeout,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        logger.error('URL scheme execution failed:', error);
        reject(new OmniAutomationError('Failed to execute URL scheme', script, error.message));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          logger.error('URL scheme execution failed with code:', code);
          reject(new OmniAutomationError(`URL scheme execution failed with code ${code}`, script, stderr));
          return;
        }

        if (stderr) {
          logger.warn('URL scheme execution warning:', stderr);
        }

        // URL scheme execution doesn't return output directly
        // We'll need to simulate success for operations like complete/delete
        logger.debug('URL scheme execution completed');
        resolve({ success: true } as T);
      });
    });
  }

  // Utility method for batch operations
  public async executeBatch<T = any>(scripts: string[]): Promise<T[]> {
    logger.info(`Executing batch of ${scripts.length} scripts`);
    
    const results: T[] = [];
    const errors: Error[] = [];
    
    // Execute in parallel with concurrency limit
    const concurrency = 3;
    const chunks: string[][] = [];
    
    for (let i = 0; i < scripts.length; i += concurrency) {
      chunks.push(scripts.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(script => this.execute<T>(script))
      );
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn(`Batch execution completed with ${errors.length} errors`);
    }
    
    return results;
  }
}