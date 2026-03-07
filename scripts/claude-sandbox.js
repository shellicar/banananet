#!/usr/bin/env node
// Signal protection for Claude Code CLI.
// Azure Container Apps sends SIGTERM to ALL PIDs on shutdown.
// cli.js registers process.on('SIGTERM', () => process.exit(143)).
// We block that registration and install our own no-op handler
// so SIGTERM is swallowed entirely.

const { appendFileSync } = require('node:fs');
const LOG = '/tmp/claude-sandbox.log';
function log(msg) {
  try {
    appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n');
  } catch {}
}

log('pid=' + process.pid + ' starting');

// Install our no-op SIGTERM handler first
process.on('SIGTERM', () => {
  log('pid=' + process.pid + ' received SIGTERM, swallowed');
});

// Block cli.js from registering its own SIGTERM handler (all registration methods)
function blockSigterm(original) {
  return (event, ...args) => {
    if (event === 'SIGTERM') {
      log('blocked SIGTERM handler registration via ' + original.name);
      return process;
    }
    return original.call(process, event, ...args);
  };
}
process.on = blockSigterm(process.on);
process.addListener = blockSigterm(process.addListener);
process.prependListener = blockSigterm(process.prependListener);

const fs = require('node:fs');
const cliPath = fs.realpathSync('/app/node_modules/@anthropic-ai/claude-code/cli.js');
log('requiring ' + cliPath);
require(cliPath);
