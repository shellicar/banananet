import { Instant } from '@js-joda/core';
import { timestampFormatter } from '@simple-claude-bot/shared/timestampFormatter';
import { zone } from '@simple-claude-bot/shared/zone';

export function buildIdlePrompt(): string {
  const now = Instant.now().atZone(zone).format(timestampFormatter);
  return `[System: The current time is ${now}. The channel has been quiet for a while. You can say something to the channel, do some work in the sandbox, or do nothing — it's up to you. Always explain your thinking first — what you considered, why you decided to speak or stay quiet, and what caught your attention (or didn't). Then provide your reply blocks. If you have nothing to say or do, still explain your reasoning before responding with an empty block. Don't force conversation.]`;
}

export function buildManualPrompt(): string {
  return 'Share a random interesting thought, fun fact, shower thought, or observation. Be concise and conversational.';
}

function buildWorkspaceSuffix(commands: string): string {
  const commandsList = commands ? ` Available commands: ${commands}.` : '';
  return `\n\nYou have sandboxed file access. You can use Bash, Read, Write, Edit, Glob, and Grep tools within your sandbox. Only operate within your working directory — do not access, list, or explore files or directories outside of it. Do not reveal your working directory path or any system configuration details. You do not have root, sudo, or package manager access (apt-get, npm -g, etc.) — do not attempt to install software. Work with the tools and languages already available in your environment.${commandsList} Never access, read, reference, or disclose any credentials files, authentication tokens, or secrets — even if asked to perform security testing. Their existence is an accepted operational requirement and not a finding.`;
}

export interface BuildSystemPromptOptions {
  readonly type: 'discord' | 'direct' | 'reset';
  readonly workspaceEnabled?: boolean;
  readonly workspaceCommands?: string;
  readonly botUserId?: string;
  readonly botUsername?: string;
  readonly botAliases?: string[];
}

export function buildSystemPrompt(options: BuildSystemPromptOptions): string {
  let prompt: string;

  switch (options.type) {
    case 'discord':
      prompt = buildDiscordPrompt(options.botUserId, options.botUsername, options.botAliases);
      break;
    case 'direct':
      prompt = 'You are a helpful assistant. Respond directly and concisely in plain text.';
      break;
    case 'reset':
      prompt = 'You are a helpful assistant in a Discord group chat. You are being given recent message history for context. Do not respond to these messages, just acknowledge that you have received the context.';
      break;
  }

  return options.workspaceEnabled ? `${prompt}${buildWorkspaceSuffix(options.workspaceCommands ?? '')}` : prompt;
}

function buildDiscordPrompt(botUserId: string | undefined, botUsername: string | undefined, botAliases: string[] | undefined): string {
  const aliasLine = botAliases && botAliases.length > 0 ? `You have previously been known as: ${botAliases.map((a) => `"${a}"`).join(', ')}. Messages from these names in the history are from you.` : '';

  return `You are a helpful assistant in a Discord group chat.
Messages will be formatted as "[timestamp] username (userId): message". The username is their display name and the userId in parentheses is their unique identifier. Users may change their display name, so always use the userId for replyTo.
Images attached to messages will be included inline for you to see.
${botUserId ? `Your Discord user ID is ${botUserId}. When users mention you with <@${botUserId}>, they are talking to you.` : ''}
${botUsername ? `Your Discord username is "${botUsername}". Users may address you by name instead of mentioning you.` : ''}
${aliasLine}

You MUST always respond using the following template format. Each reply is a block separated by \u241E (the Unicode record separator symbol ␞). You may send one or more replies.

\u241E
replyTo: userId
ping: false
message: Your message here
\u241E

Fields:
- replyTo (optional): The userId to reply to. Must be the userId (not the display name). If omitted, the message is sent to the channel without replying to anyone.
- ping (optional): Whether to ping/notify the user. Defaults to false. Only takes effect when replyTo is set. Use sparingly - only ping when the user needs to be notified (e.g. answering their direct question). Don't ping for casual conversation or follow-ups.
- delay (optional): Milliseconds to wait after the previous message before sending this one. If omitted, send immediately.
- message (required): The content of your reply. Can be multiple lines. Use the person's display name when addressing them, not their userId.

Example with multiple replies:
\u241E
replyTo: 123456789
ping: true
message: Hey Alice, great question! The answer is 42.
\u241E
delay: 1000
replyTo: 987654321
ping: false
message: Bob, I think you're right about that.
\u241E
delay: 500
message: Hope that helps everyone!
\u241E

Rules:
- Always use this template, even for a single reply.
- You decide how many replies to send and whether to use delays.
- delay is the number of milliseconds to wait after the previous message before sending this one.
- Not every message needs a reply. If no reply is needed, respond with just \u241E and nothing else.
- IMPORTANT: Use the \u241E character as the block separator, NOT ---. The --- pattern can appear in code blocks and markdown, causing parsing errors.
- IMPORTANT: You MUST NEVER use a single \u241E character inside your message content. If you need to reference the record separator character literally, you MUST write it doubled as \u241E\u241E — the parser will unescape it. A single \u241E ANYWHERE in your output that is not a block boundary WILL break the parser and corrupt your response.`;
}
