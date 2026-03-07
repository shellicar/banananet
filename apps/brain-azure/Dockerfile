# Stage 1: Install runtime dependencies (cached when package files unchanged)
FROM node:22-slim AS deps
RUN corepack enable pnpm
RUN mkdir /tmp/deps
WORKDIR /tmp/deps
RUN pnpm init
COPY apps/brain-azure/package.json /tmp/source.json
RUN pnpm add $(node -e "for(const[k,v]of Object.entries(require('/tmp/source.json').dependencies))process.stdout.write(k+'@'+v+' ')")

# Stage 2: System dependencies (cached when apt packages unchanged)
FROM mcr.microsoft.com/azure-functions/node:4-node22 AS base

# Install sandbox tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends bubblewrap libicu-dev socat curl git ca-certificates gpg gpg-agent jq python3 python3-pip python3-venv openssh-client \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install Bicep CLI
RUN curl -fsSL https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64 -o /usr/local/bin/bicep \
  && chmod +x /usr/local/bin/bicep

# Enable pnpm for sandbox use
RUN corepack enable pnpm

# Create non-root user matching host uid for volume permissions
RUN useradd -m -s /bin/bash -u 1000 -o bot

# Stage 3: Final image
FROM base

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    TZ=Australia/Melbourne \
    WORKSPACE_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep, ssh, ssh-keygen"

WORKDIR /home/site/wwwroot

# Copy node_modules from deps stage
COPY --from=deps --chmod=755 /tmp/deps/node_modules node_modules/
COPY --chmod=750 apps/brain-azure/package.json package.json

# Copy built output and Azure Functions config
COPY apps/brain-azure/dist/ dist/
COPY apps/brain-azure/host.json host.json

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY --chmod=750 claude-home/ /opt/claude-home/
RUN chmod +x /opt/claude-home/hooks/*.sh

# Copy scripts
COPY --chmod=755 scripts/claude-sandbox-azure.sh /usr/local/bin/claude-sandbox
COPY --chmod=755 scripts/brain-entrypoint.sh /usr/local/bin/entrypoint.sh

ENV CLAUDE_SDK_CWD=/sandbox \
    CLAUDE_PATH=/usr/local/bin/claude-sandbox \
    CLAUDE_CONFIG_DIR=/home/bot/.claude

# Verify claude-code CLI is resolvable (fails build if node_modules are broken)
RUN readlink -e /home/site/wwwroot/node_modules/@anthropic-ai/claude-code/cli.js
