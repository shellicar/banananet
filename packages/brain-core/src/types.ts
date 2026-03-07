import type { UUID } from 'node:crypto';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { CompactRequestSchema, DirectRequestSchema, PlatformAttachmentSchema, PlatformMessageSchema, ResetRequestSchema, RespondRequestSchema, SessionSetRequestSchema, UnpromptedRequestSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { z } from 'zod';

export type PlatformAttachmentOutput = z.output<typeof PlatformAttachmentSchema>;
export type PlatformMessageOutput = z.output<typeof PlatformMessageSchema>;
export type RespondRequestOutput = z.output<typeof RespondRequestSchema>;
export type UnpromptedRequestOutput = z.output<typeof UnpromptedRequestSchema>;
export type DirectRequestOutput = z.output<typeof DirectRequestSchema>;
export type ResetRequestOutput = z.output<typeof ResetRequestSchema>;
export type SessionSetRequestOutput = z.output<typeof SessionSetRequestSchema>;
export type CompactRequestOutput = z.output<typeof CompactRequestSchema>;

export interface SdkConfig {
  readonly cwd: string;
  readonly defaultMaxTurns: number;
  readonly workspaceMaxTurns: number;
  readonly botAliases: string[];
  readonly workspaceCommands: string;
}
export type ClaudeModels = 'claude-opus-4-6' | 'claude-sonnet-4-5-20250929' | 'claude-haiku-4-5-20251001';

export type SDKMessageWithSubtype = SDKMessage & { subtype?: string };

export type ClaudeGlobals = {
  claudeDir: string | undefined;
  SESSION_FILE: string | undefined;
  DIRECT_SESSION_FILE: string | undefined;
  COMPACT_FILE: string | undefined;
  sessionId: UUID | undefined;
  directSessionId: UUID | undefined;
};
