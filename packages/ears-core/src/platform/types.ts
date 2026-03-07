import type { PlatformMessageInput } from '../types';

export interface SentMessage {
  id: string;
  timestamp: number;
  message: string;
}

export interface PlatformChannel {
  sendMessage(content: string): Promise<SentMessage[]>;
  replyTo(message: PlatformMessageInput, content: string): Promise<SentMessage[]>;
  sendTyping(): Promise<void>;
  fetchHistory(limit: number): Promise<PlatformMessageInput[]>;
  trackMessage(message: PlatformMessageInput): void;
  clearTracked(): void;
}
