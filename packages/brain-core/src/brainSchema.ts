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
    .superRefine((val, ctx) => {
      try {
        JSON.parse(val);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, input: val, message: `CALLBACK_HEADERS is not valid JSON: ${val}` });
      }
    })
    .transform((val) => {
      return JSON.parse(val);
    })
    .pipe(z.record(z.string(), z.string())),
});
