#!/bin/sh
export HOME=/home/bot
exec setpriv --reuid=bot --regid=bot --init-groups -- node /usr/local/bin/claude-sandbox.js "$@"
