#!/usr/bin/env node
/**
 * One-shot CLI to inspect or modify a live Sound Machine browser session.
 * Usage:
 *   node mcp-server/cli.mjs <sessionId> <toolName> [jsonArgs]
 * Example:
 *   node mcp-server/cli.mjs sm-a8f3k9m2 get_session_state
 *   node mcp-server/cli.mjs sm-a8f3k9m2 set_piano_drawer '{"open":true,"octave":4}'
 */

import { sendSessionCommand, closeAllConnections } from './session-client.mjs';

const [, , sessionId, toolName, rawArgs] = process.argv;

if (!sessionId || !toolName) {
  console.error('Usage: node mcp-server/cli.mjs <sessionId> <toolName> [jsonArgs]');
  process.exit(1);
}

const args = rawArgs ? JSON.parse(rawArgs) : {};

try {
  const result =
    toolName === 'ping' || toolName === 'ping_session'
      ? await sendSessionCommand(sessionId, 'ping', {})
      : await sendSessionCommand(sessionId, 'call_tool', { name: toolName, args });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  closeAllConnections();
}
