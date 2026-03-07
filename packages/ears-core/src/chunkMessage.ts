const DISCORD_MAX_LENGTH = 2000;
const MIN_BREAK_POINT = 1000;

// TODO: handle splitting inside code blocks (close/re-open fences across chunks)
export function chunkMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    let breakPoint = remaining.lastIndexOf('\n', DISCORD_MAX_LENGTH);
    if (breakPoint === -1 || breakPoint < MIN_BREAK_POINT) {
      breakPoint = remaining.lastIndexOf(' ', DISCORD_MAX_LENGTH);
    }
    if (breakPoint === -1 || breakPoint < MIN_BREAK_POINT) {
      breakPoint = DISCORD_MAX_LENGTH;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}
