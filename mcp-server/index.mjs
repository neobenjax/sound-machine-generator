#!/usr/bin/env node
/**
 * Zero-dependency MCP (Model Context Protocol) stdio server for Sound Machine Generator.
 * Connects harness AI agents (Claude Code, Cursor, Codex, Antigravity, etc.)
 * to a live browser Sound Machine session via its temporary Session ID.
 */

import readline from 'node:readline';
import { sendSessionCommand, closeAllConnections } from './session-client.mjs';

const SESSION_PROP = {
  sessionId: {
    type: 'string',
    description:
      'Temporary Session ID shown in the browser AI Copilot panel (e.g. sm-a8f3k9m2)',
  },
  brokerUrl: {
    type: 'string',
    description:
      'Optional custom WebSocket/MQTT relay URL (defaults to wss://broker.emqx.io:8084/mqtt)',
  },
};

const TOOLS = [
  {
    name: 'ping_session',
    description: 'Verify connectivity to a live Sound Machine browser session.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_session_state',
    description:
      'Get the complete live state of the Sound Machine browser session: active view (studio/daw/integrate), audioState, active Studio sound recipe & layers, DAW project & tracks, and Piano drawer/recording state.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'switch_view',
    description: 'Switch the active UI tab in Sound Machine between studio, daw, and integrate.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        view: { type: 'string', enum: ['studio', 'daw', 'integrate'] },
      },
      required: ['sessionId', 'view'],
    },
  },
  {
    name: 'list_sound_presets',
    description:
      'List all available sound playlists and sound recipes (built-in and custom saved sounds).',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'load_sound_preset',
    description: 'Load an existing sound preset into the Composer Console by id or name.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        idOrName: { type: 'string', description: 'Exact sound id or case-insensitive name.' },
      },
      required: ['sessionId', 'idOrName'],
    },
  },
  {
    name: 'compose_sound',
    description:
      'Compose a brand-new procedural sound by specifying synthesis layers and load it into the Composer Console.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        name: { type: 'string' },
        description: { type: 'string' },
        masterVolumeDb: { type: 'number' },
        reverbMix: { type: 'number' },
        reverbDecaySec: { type: 'number' },
        layers: { type: 'array', items: { type: 'object' } },
      },
      required: ['sessionId', 'name', 'layers'],
    },
  },
  {
    name: 'tune_sound_layer',
    description:
      'Tune parameters of an existing layer (by 0-based index) or recipe-level masterVolumeDb, reverbMix, and reverbDecaySec on the active Console sound.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        layerIndex: { type: 'number' },
        masterVolumeDb: { type: 'number' },
        reverbMix: { type: 'number' },
        reverbDecaySec: { type: 'number' },
        patch: { type: 'object' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'add_sound_layer',
    description:
      'Add a new synthesis layer (tone, noise, or fm) to the currently active Studio Console sound.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        index: { type: 'number', description: 'Optional 0-based insertion index.' },
        layer: { type: 'object', description: 'Layer configuration.' },
      },
      required: ['sessionId', 'layer'],
    },
  },
  {
    name: 'remove_sound_layer',
    description:
      'Remove a synthesis layer from the active Studio Console sound by 0-based layerIndex (minimum 1 layer must remain).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        layerIndex: { type: 'number' },
      },
      required: ['sessionId', 'layerIndex'],
    },
  },
  {
    name: 'play_current_sound',
    description: 'Audition the currently loaded sound in the browser AudioContext.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'export_current_sound',
    description:
      'Get the generated Tone.js code, Vanilla Web Audio API code, and JSON recipe for the active sound.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        download: { type: 'boolean' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'save_current_sound',
    description: 'Save the currently loaded sound into browser localStorage under My Studio Library.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_daw_project',
    description: 'Inspect the current DAW project (tracks 1-8, BPM, stepCount, loop, and programmed steps).',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'configure_daw_project',
    description: 'Update DAW project metadata (name, bpm, stepCount 16 or 32, loop).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        name: { type: 'string' },
        bpm: { type: 'number' },
        stepCount: { type: 'number', enum: [16, 32] },
        loop: { type: 'boolean' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'add_daw_track',
    description: 'Add a new track to the DAW (maximum 8 tracks) using a sound recipe id or name.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        name: { type: 'string' },
        recipeIdOrName: { type: 'string' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'remove_daw_track',
    description: 'Remove a track from the DAW by 0-based trackIndex (minimum 1 track must remain).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        trackIndex: { type: 'number' },
      },
      required: ['sessionId', 'trackIndex'],
    },
  },
  {
    name: 'update_daw_track',
    description:
      'Modify an existing DAW track by 0-based trackIndex (rename, swap sound recipe, mute/solo, volumeDb, pan).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        trackIndex: { type: 'number' },
        name: { type: 'string' },
        recipeIdOrName: { type: 'string' },
        muted: { type: 'boolean' },
        solo: { type: 'boolean' },
        volumeDb: { type: 'number' },
        pan: { type: 'number' },
      },
      required: ['sessionId', 'trackIndex'],
    },
  },
  {
    name: 'set_daw_track_steps',
    description: 'Program note steps on a DAW track (by 0-based trackIndex).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        trackIndex: { type: 'number' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              step: { type: 'number' },
              midiNote: { type: 'number' },
              velocity: { type: 'number' },
              lengthSteps: { type: 'number' },
            },
            required: ['step', 'midiNote'],
          },
        },
      },
      required: ['sessionId', 'trackIndex', 'steps'],
    },
  },
  {
    name: 'play_daw_project',
    description: 'Start playing the current DAW composition.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'stop_daw_project',
    description: 'Stop DAW playback.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'export_daw_composition',
    description: 'Export the active DAW composition as Tone.js code, Vanilla Web Audio API code, and JSON.',
    inputSchema: {
      type: 'object',
      properties: { ...SESSION_PROP },
      required: ['sessionId'],
    },
  },
  {
    name: 'set_piano_drawer',
    description: 'Show or hide the interactive Piano Drawer keyboard and optionally set its octave (2-6).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        open: { type: 'boolean' },
        octave: { type: 'number' },
      },
      required: ['sessionId', 'open'],
    },
  },
  {
    name: 'piano_recording',
    description:
      'Control Piano Drawer recording: start, stop, get, clear, or send_to_daw (with optional trackIndex).',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        action: { type: 'string', enum: ['start', 'stop', 'get', 'clear', 'send_to_daw'] },
        trackIndex: { type: 'number' },
      },
      required: ['sessionId', 'action'],
    },
  },
  {
    name: 'play_piano_notes',
    description:
      'Play a sequence of MIDI notes using the active recipe (or selected DAW track recipe). Highlights keys on the Piano Drawer and records notes if recording is active.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        openDrawer: { type: 'boolean' },
        notes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              midiNote: { type: 'number' },
              durationMs: { type: 'number' },
              delayMs: { type: 'number' },
              velocity: { type: 'number' },
            },
            required: ['midiNote'],
          },
        },
      },
      required: ['sessionId', 'notes'],
    },
  },
  {
    name: 'analyze_audio_to_layers',
    description:
      'Decode a monophonic .wav / audio base64 string (or raw PCM float array) into procedural SoundLayer[] and load it into the Console.',
    inputSchema: {
      type: 'object',
      properties: {
        ...SESSION_PROP,
        name: { type: 'string' },
        audioBase64: { type: 'string' },
        pcmSamples: { type: 'array', items: { type: 'number' } },
        sampleRate: { type: 'number' },
        loadInConsole: { type: 'boolean' },
      },
      required: ['sessionId'],
    },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'sound-machine-mcp',
          version: '1.0.0',
        },
      },
    });
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    return send({
      jsonrpc: '2.0',
      id,
      result: { tools: TOOLS },
    });
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const rawArgs = params?.arguments || {};
    const { sessionId, brokerUrl, ...toolArgs } = rawArgs;

    try {
      if (!sessionId) {
        throw new Error('Missing required parameter: sessionId');
      }

      let result;
      if (toolName === 'ping_session') {
        result = await sendSessionCommand(sessionId, 'ping', {}, { brokerUrl });
      } else {
        result = await sendSessionCommand(
          sessionId,
          'call_tool',
          { name: toolName, args: toolArgs },
          { brokerUrl }
        );
      }

      return send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      });
    } catch (err) {
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        },
      });
    }
  }

  if (id !== undefined) {
    send({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const req = JSON.parse(trimmed);
    void handleRequest(req);
  } catch (err) {
    console.error('[sound-machine-mcp] Invalid JSON:', err);
  }
});

rl.on('close', () => {
  closeAllConnections();
  process.exit(0);
});
