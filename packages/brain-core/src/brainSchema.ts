import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const inputNumberSchema = z
  .string()
  .transform((val) => {
    const trimmed = val.trim();
    if (trimmed === '' || Number.isNaN(Number(trimmed))) {
      return val;
    }
    return Number(trimmed);
  })
  .pipe(z.number().int().min(1));

export const brainSchema = z.object({
  CONTAINER_APP_PORT: inputNumberSchema,
  CLAUDE_CONFIG_DIR: z.string().default(join(homedir(), '.claude')),
  CLAUDE_SDK_CWD: z
    .string()
    .transform((x) => resolve(x))
    .default('./sandbox'),
  CLAUDE_SDK_DEFAULT_MAXTURNS: z.coerce.number().int().positive().default(1),
  CLAUDE_SDK_WORKSPACE_MAXTURNS: z.coerce.number().int().positive().default(25),
  BOT_ALIASES: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    )
    .default([]),
  WORKSPACE_COMMANDS: z.string().default(''),
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
