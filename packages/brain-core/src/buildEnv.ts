import { ENV_PASSTHROUGH } from './consts';

export function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of ENV_PASSTHROUGH) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  const botHome = process.env.BOT_HOME;
  if (botHome) {
    env.HOME = botHome;
  }
  return env;
}
