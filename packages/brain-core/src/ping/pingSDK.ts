import { BotCapability } from '@simple-claude-bot/shared/shared/platform/schema';
import type { AuditWriter } from '../audit/auditLog';
import { buildQueryOptions } from '../buildQueryOptions';
import { executeQuery } from '../executeQuery';
import type { SdkConfig } from '../types';

export async function pingSDK(audit: AuditWriter, sdkConfig: SdkConfig): Promise<string> {
  const options = buildQueryOptions({
    systemPrompt: 'Respond with exactly: pong',
    capabilities: { [BotCapability.Web]: false, [BotCapability.Workspace]: false },
    sdkConfig,
  });

  return executeQuery(audit, '/ping', 'ping', options, () => {});
}
