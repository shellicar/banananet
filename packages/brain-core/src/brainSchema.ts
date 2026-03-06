import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export const brainSchema = z.object({
  CLAUDE_CONFIG_DIR: z.string().default(join(homedir(), '.claude')),
  SANDBOX_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  SANDBOX_DIR: z.string().default('./sandbox'),
  SANDBOX_COMMANDS: z.string().default(''),
  AUDIT_DIR: z.string().default('/audit'),
  CALLBACK_HEADERS: z
    .string()
    .transform((val) => JSON.parse(val) as Record<string, string>)
    .pipe(z.record(z.string(), z.string())),
});
