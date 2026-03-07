import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import type { SdkConfig } from '../types';

export async function pingSDK(audit: AuditWriter, sdkConfig: SdkConfig, abortController?: AbortController): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: 'Respond with exactly: pong',
    capabilities: { [BotCapability.Web]: false, [BotCapability.Workspace]: false },
    sdkConfig,
    abortController,
  });

  return executeQuery(audit, '/ping', 'ping', options, () => {});
}
