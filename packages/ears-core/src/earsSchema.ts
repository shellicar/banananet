import { z } from 'zod';

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
  BRAIN_URL: z.string().min(1).default('http://brain:3000'),
  BRAIN_KEY: z.string().min(1).optional(),
  SANDBOX_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  SANDBOX_COMMANDS: z.string().default(''),
  CALLBACK_PORT: z.coerce.number().int().default(3001),
  CALLBACK_HOST: z.url(),
});
