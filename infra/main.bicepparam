using 'main.bicep'

param location = 'australiaeast'
param locationCode = 'aue'
param env = 'dev'

param brainKey = readEnvironmentVariable('BRAIN_KEY')
param claudeCodeOauthToken = readEnvironmentVariable('CLAUDE_CODE_OAUTH_TOKEN')
param discordGuild = readEnvironmentVariable('DISCORD_GUILD')
param discordToken = readEnvironmentVariable('DISCORD_TOKEN')
param callbackHeaders = readEnvironmentVariable('CALLBACK_HEADERS')
param botAliases = readEnvironmentVariable('BOT_ALIASES')
param allowedIp = readEnvironmentVariable('ALLOWED_IP')
