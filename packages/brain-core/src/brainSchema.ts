import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

export const brainSchema = z.object({
  CLAUDE_CONFIG_DIR: z.string().default(join(homedir(), '.claude')),
  CLAUDE_SDK_CWD: z
    .string()
    .transform((x) => resolve(x))
    .default('./sandbox'),
  CLAUDE_SDK_DEFAULT_MAXTURNS: z.coerce.number().int().positive().default(1),
  CLAUDE_SDK_WORKSPACE_MAXTURNS: z.coerce.number().int().positive().default(25),
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
