import type { AuditWriter } from './audit/auditLog';
import { buildQueryOptions } from './buildQueryOptions';
import { saveDirectSession } from './direct/saveDirectSession';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import { buildSystemPrompt } from './systemPrompts';
import type { DirectRequestOutput, SdkConfig } from './types';

export async function directQuery(audit: AuditWriter, body: DirectRequestOutput, sdkConfig: SdkConfig): Promise<string> {
  const systemPrompt = buildSystemPrompt({ type: 'direct' });

  const options = buildQueryOptions({
    systemPrompt,
    capabilities: body.capabilities,
    sdkConfig,
    sessionId: claudeGlobals.directSessionId,
  });

  return executeQuery(audit, '/direct', body.prompt, options, saveDirectSession);
}
