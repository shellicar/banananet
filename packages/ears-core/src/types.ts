import type { CompactRequestSchema, DirectRequestSchema, PlatformAttachmentSchema, PlatformMessageSchema, ResetRequestSchema, RespondRequestSchema, SessionSetRequestSchema, UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { z } from 'zod';

export type PlatformAttachmentInput = z.input<typeof PlatformAttachmentSchema>;
export type PlatformMessageInput = z.input<typeof PlatformMessageSchema>;
export type RespondRequestInput = z.input<typeof RespondRequestSchema>;
export type UnpromptedRequestInput = z.input<typeof UnpromptedRequestSchema>;
export type DirectRequestInput = z.input<typeof DirectRequestSchema>;
export type ResetRequestInput = z.input<typeof ResetRequestSchema>;
export type SessionSetRequestInput = z.input<typeof SessionSetRequestSchema>;
export type CompactRequestInput = z.input<typeof CompactRequestSchema>;
