FROM node:22-slim AS base

# Install sandbox dependencies and tools
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

FROM node:22-slim

COPY --from=base / /

WORKDIR /app

# Install runtime dependencies (claude-agent-sdk is external, claude-code is a subprocess)
COPY --chmod=750 package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chmod=750 apps/brain/package.json apps/brain/package.json
COPY --chmod=750 packages/brain-core/package.json packages/brain-core/package.json
COPY --chmod=750 packages/shared/package.json packages/shared/package.json
RUN pnpm install --prod --frozen-lockfile --filter=@simple-claude-bot/brain...

# Set node_modules permissions before dist (rarely changes, stays cached)
RUN chmod o+x /app /app/apps /app/apps/brain \
  && chmod -R o+rX /app/node_modules

WORKDIR /app/apps/brain

# Copy built output (esbuild bundle is self-contained)
COPY --chmod=750 apps/brain/dist/ dist/

# Copy Claude settings and hooks to staging (volume mount overlays /home/bot/.claude at runtime)
COPY --chmod=750 claude-home/ /opt/claude-home/
RUN chmod +x /opt/claude-home/hooks/*.sh

# Copy scripts
COPY --chmod=755 scripts/claude-sandbox.sh /usr/local/bin/claude-sandbox
COPY --chmod=755 scripts/brain-entrypoint.sh /usr/local/bin/entrypoint.sh

ENV TZ=Australia/Melbourne
ENV SANDBOX_DIR=/sandbox
ENV SANDBOX_ENABLED=true
ENV CLAUDE_PATH=/usr/local/bin/claude-sandbox
ENV CLAUDE_CONFIG_DIR=/home/bot/.claude
ENV SANDBOX_COMMANDS="node, pnpm, git, gh, jq, curl, python3, pip3, bicep, ssh, ssh-keygen"

HEALTHCHECK --interval=5s --timeout=5s --retries=10 --start-period=5s \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/brain.js"]
