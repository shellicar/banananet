import type { UUID } from 'node:crypto';
import { type Options, query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '@simple-claude-bot/shared/logger';
import { UuidSchema } from '@simple-claude-bot/shared/shared/platform/schema';
import type { AuditWriter } from './audit/auditLog';
import { ApiError } from './errors/ApiError';
import { RateLimitError } from './errors/RateLimitError';
import { ResultErrorError } from './errors/ResultErrorError';
import { ResultSuccessError } from './errors/ResultSuccessError';
import { UsageLimitError } from './errors/UsageLimitError';
import { hasSubType } from './hasSubType';
import { SdkResult } from './sdk/SdkResult';

export async function executeQuery(audit: AuditWriter, endpoint: string, prompt: string | AsyncIterable<SDKUserMessage>, options: Options, onSessionId: (id: UUID) => void): Promise<string> {
  const startTime = Date.now();
  const timer = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.debug(`Still waiting after ${elapsed}s...`);
  }, 5000);

  logger.debug(`Query options: ${JSON.stringify(options, undefined, 2)}`);

  let result = '';
  try {
    const q = query({ prompt, options });

    for await (const msg of q) {
      audit.write(endpoint, msg);
      if (hasSubType(msg)) {
        logger.debug(`SDK message: ${msg.type}/${(msg as { subtype?: string }).subtype}`);
      }
      if (msg.type === 'system' && msg.subtype === 'init') {
        logger.info(`SDK init: session=${msg.session_id} model=${msg.model} permissionMode=${msg.permissionMode} tools=${msg.tools.join(',')}`);
        onSessionId(UuidSchema.parse(msg.session_id, { reportInput: true }));
      }
      if (msg.type === 'tool_use_summary') {
        logger.info(`SDK tool use: ${msg.summary}`);
      }
      if (msg.type === 'result') {
        const sdkResults: string[] = ['SDK result:', `subtype=${msg.subtype}`, `is_error=${msg.is_error}`];
        if (msg.stop_reason != null) {
          sdkResults.push(`stop_reason=${msg.stop_reason}`);
        }
        if (msg.total_cost_usd !== 0) {
          sdkResults.push(`cost=$${msg.total_cost_usd.toFixed(4)}`);
        }
        if (msg.usage.input_tokens !== 0 || msg.usage.output_tokens !== 0) {
          sdkResults.push(`tokens=${msg.usage.input_tokens}in/${msg.usage.output_tokens}out`);
        }
        if (msg.num_turns !== 0) {
          sdkResults.push(`turns=${msg.num_turns}`);
        }
        if (msg.duration_ms !== 0) {
          sdkResults.push(`duration=${msg.duration_ms}ms`);
        }
        if (msg.duration_api_ms !== 0) {
          sdkResults.push(`duration_api=${msg.duration_api_ms}ms`);
        }

        logger.info(sdkResults.join(' '));

        if (msg.subtype === 'success') {
          if (msg.is_error) {
            const sdkResult = new SdkResult(msg);

            if (sdkResult.isRateLimited) {
              logger.warn(`Rate limited: ${msg.result}`);
              throw new RateLimitError(msg.result);
            }

            if (sdkResult.apiError) {
              logger.error(`API error ${sdkResult.apiError.statusCode}: ${sdkResult.apiError.errorType}: ${sdkResult.apiError.errorMessage}`);
              throw new ApiError(sdkResult.apiError.statusCode, sdkResult.apiError.errorType, sdkResult.apiError.errorMessage);
            }

            logger.error('SDK error', msg);

            if (msg.stop_reason === 'stop_sequence') {
              throw new UsageLimitError(msg.result);
            }

            throw new ResultSuccessError(msg.result, msg.stop_reason);
          }
          result = msg.result;
          logger.info(`SDK success result: ${result}`);
        } else {
          logger.error('SDK error', msg);
          throw new ResultErrorError(msg.subtype, msg.stop_reason, msg.errors);
        }
      }
    }
  } catch (error) {
    if (result) {
      logger.warn(`SDK process error after successful result: ${error}`);
    } else {
      throw error;
    }
  } finally {
    clearInterval(timer);
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  logger.info(`Response (${elapsed}s): ${result}`);

  return result;
}
