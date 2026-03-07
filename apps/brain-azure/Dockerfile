# Stage 1: Install runtime dependencies (cached separately — these rarely change)
FROM node:22-slim AS deps
RUN corepack enable pnpm
RUN mkdir /tmp/deps
WORKDIR /tmp/deps
RUN pnpm init
COPY apps/brain-azure/package.json /tmp/source.json
RUN pnpm add $(node -e "for(const[k,v]of Object.entries(require('/tmp/source.json').dependencies))process.stdout.write(k+'@'+v+' ')")

# Stage 2: Main image
FROM mcr.microsoft.com/azure-functions/node:4-node22

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true \
    TZ=Australia/Melbourne \
    SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep, ssh, ssh-keygen"

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

WORKDIR /home/site/wwwroot

# Copy runtime dependencies from deps stage
COPY --from=deps /tmp/deps/node_modules node_modules/
COPY apps/brain-azure/package.json package.json

# Copy built output and Azure Functions config
COPY apps/brain-azure/dist/ dist/
COPY apps/brain-azure/host.json host.json

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY claude-home/ /opt/claude-home/

# Copy scripts
COPY scripts/claude-sandbox-azure.sh /usr/local/bin/claude-sandbox
COPY scripts/brain-entrypoint.sh /usr/local/bin/entrypoint.sh

# Lock down app files and set permissions
RUN chmod -R 750 /home/site/wwwroot \
  && chmod o+x /home/site/wwwroot \
  && chmod -R o+rX /home/site/wwwroot/node_modules \
  && chmod +x /opt/claude-home/hooks/*.sh \
  && chmod +x /usr/local/bin/claude-sandbox \
  && chmod +x /usr/local/bin/entrypoint.sh

ENV CLAUDE_SDK_CWD=/sandbox \
    CLAUDE_PATH=/usr/local/bin/claude-sandbox \
    CLAUDE_CONFIG_DIR=/home/bot/.claude
