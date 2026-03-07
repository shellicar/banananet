import { logger } from '@simple-claude-bot/shared/logger';
import type { Message } from 'discord.js';
import { fileTypeFromBuffer } from 'file-type';
import type { PlatformAttachmentInput, PlatformMessageInput } from '../../types';

async function downloadAttachment(url: string, contentType: string | null): Promise<PlatformAttachmentInput> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn(`Failed to download attachment: ${response.status} ${response.statusText}`);
      return {
        url,
        contentType,
      };
    }
    const buffer = await response.arrayBuffer();
    const type = await fileTypeFromBuffer(buffer);
    const mimeType = type?.mime ?? contentType;
    const base64 = Buffer.from(buffer).toString('base64');
    const attachment = {
      url,
      contentType: mimeType,
      data: base64,
    } satisfies PlatformAttachmentInput;
    logger.info('Creating attachment', {
      url: attachment.url,
      contentType: attachment.contentType,
      dataLength: attachment.data.length,
    });

    return attachment;
  } catch (error) {
    logger.warn(`Failed to download attachment ${url}: ${error}`);
    return {
      url,
      contentType,
    };
  }
}

export class DiscordMessage implements PlatformMessageInput {
  public readonly authorId: string;
  public readonly authorDisplayName: string;
  public readonly authorIsBot: boolean;
  public readonly content: string;
  public readonly createdTimestamp: number;
  public readonly attachments: PlatformAttachmentInput[];
  public readonly messageId: string;
  /** @internal */
  public readonly _raw: Message;

  private constructor(message: Message, attachments: PlatformAttachmentInput[]) {
    this._raw = message;
    this.authorId = message.author.id;
    this.authorDisplayName = message.author.displayName;
    this.authorIsBot = message.author.bot;
    this.content = message.content;
    this.createdTimestamp = message.createdTimestamp;
    this.attachments = attachments;
    this.messageId = message.id;
  }

  public static async from(message: Message): Promise<DiscordMessage> {
    const attachments: PlatformAttachmentInput[] = await Promise.all(
      [...message.attachments.values()].map(async (a) => {
        return await downloadAttachment(a.url, a.contentType);
      }),
    );
    return new DiscordMessage(message, attachments);
  }
}
