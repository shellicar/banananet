import type { AuditWriter } from './audit/auditLog';
import { buildQueryOptions } from './buildQueryOptions';
import { saveDirectSession } from './direct/saveDirectSession';
import { executeQuery } from './executeQuery';
import { claudeGlobals } from './globals';
import type { DirectRequestOutput, SdkConfig } from './types';

export async function directQuery(audit: AuditWriter, body: DirectRequestOutput, sdkConfig: SdkConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: body.systemPrompt,
    capabilities: body.capabilities,
    sdkConfig,
    sessionId: claudeGlobals.directSessionId,
  });

  return executeQuery(audit, '/direct', body.prompt, options, saveDirectSession);
}
