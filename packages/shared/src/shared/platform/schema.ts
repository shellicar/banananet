import type { UUID } from 'node:crypto';
import { z } from 'zod';

export const UuidSchema = z.uuid().transform((x) => x as UUID);

export const PlatformAttachmentSchema = z.object({
  url: z.string(),
  contentType: z.string().nullable(),
  data: z.string().optional(),
});

export const PlatformMessageSchema = z.object({
  authorId: z.string(),
  authorDisplayName: z.string(),
  authorIsBot: z.boolean(),
  content: z.string(),
  createdTimestamp: z.number(),
  attachments: z.array(PlatformAttachmentSchema),
  messageId: z.string().optional(),
});

// --- Shared building blocks ---

export const ReplySchema = z.object({
  replyTo: z.string().optional(),
  ping: z.boolean().optional(),
  delay: z.number().optional(),
  message: z.string(),
});

// --- Request schemas ---

export const RespondRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
  callbackUrl: z.string().url(),
});

export const UnpromptedRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()).optional(),
  maxTurns: z.number().optional(),
});

export const DirectRequestSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()),
});

export const ResetRequestSchema = z.object({
  messages: z.array(PlatformMessageSchema),
  systemPrompt: z.string(),
});

export const SessionSetRequestSchema = z.object({
  sessionId: UuidSchema,
});

export const CompactRequestSchema = z.object({
  resumeSessionAt: UuidSchema.optional(),
});

// --- Response schemas ---

export const RespondResponseSchema = z.object({
  replies: z.array(ReplySchema),
  error: z.string().optional(),
});

export const UnpromptedResponseSchema = z.object({
  replies: z.array(ReplySchema),
  spoke: z.boolean(),
  error: z.string().optional(),
});

export const DirectResponseSchema = z.object({
  result: z.string(),
  error: z.string().optional(),
});

export const CompactResponseSchema = z.object({
  result: z.string(),
  error: z.string().optional(),
});

export const ResetResponseSchema = z.object({
  result: z.string(),
  error: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

export const PingResponseSchema = z.object({
  result: z.string(),
  error: z.string().optional(),
});

export const SessionResponseSchema = z.object({
  sessionId: z.string().nullable(),
});

export const VersionResponseSchema = z.object({
  version: z.string(),
  shortSha: z.string(),
  buildDate: z.string(),
});

// --- Callback API ---

export const CallbackRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('typing'),
  }),
  z.object({
    type: z.literal('message'),
    replies: z.array(ReplySchema),
  }),
]);

export const CallbackResponseSchema = z.object({
  delivered: z.array(
    z.object({
      index: z.number(),
      messageIds: z.array(z.string()),
    }),
  ),
});
