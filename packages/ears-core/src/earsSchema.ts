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

export const earsSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_GUILD: z.string().min(1),
  CLAUDE_CHANNEL: z.string().min(1).default('claude'),
  BOT_ALIASES: z
    .string()
    .transform((val) =>
      val
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    )
    .default([]),
  BRAIN_URL: z.string().min(1).default('http://brain/api'),
  BRAIN_KEY: z.string().min(1).optional(),
  WORKSPACE_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  SANDBOX_COMMANDS: z.string().default(''),
  CONTAINER_APP_PORT: inputNumberSchema,
  CALLBACK_HOST: z.url(),
});
