# onpe-cli

Agent-first CLI for ONPE election data. Query mesas, actas, rankings, and summaries from Peru's official election results API.

## Install

```bash
bun add -g @crafter/onpe-cli
```

## Quick Start

```bash
# Who's winning?
onpe-cli ranking

# Check API status
onpe-cli doctor

# Look up a mesa
onpe-cli mesa 044739

# Full vote breakdown
onpe-cli acta 4473914011310

# Election summary
onpe-cli resumen

# Browse geography
onpe-cli ubigeos 1
onpe-cli ubigeos 2 150000
```

## Commands

| Command | Description |
|---------|-------------|
| `ranking` | National candidate ranking with party-colored bars |
| `doctor` | Check API connectivity (4 endpoint checks) |
| `mesa <codigo>` | Look up a mesa by code (000001-088064, 900001-904703) |
| `acta <id>` | Full vote breakdown per party |
| `resumen` | Election summary with progress bars |
| `ubigeos [nivel] [padre]` | Geographic drill-down (dept/prov/dist) |
| `file-url <fileId>` | Get download URL for acta PDF |

## Agent Integration

Designed for AI agents as primary consumers.

```bash
# Auto-JSON when piped
onpe-cli ranking --json | jq '.[0]'

# NDJSON arrays for stream parsing
onpe-cli mesa 044739 --json

# Next-step hints on stderr
onpe-cli doctor 2>/dev/null  # data only
onpe-cli doctor 2>&1         # data + hints
```

**stdout**: Data only. NDJSON in JSON mode.
**stderr**: Notes + `{"type":"next-step","command":"...","description":"..."}` hints.
**Error codes**: `CDN_BLOCKED`, `TIMEOUT`, `NOT_FOUND`, `NO_ELECTION`, `NETWORK` with `.hint` for self-recovery.

## Flags

| Flag | Description |
|------|-------------|
| `--json` | Emit JSON (auto when piped) |
| `--quiet` | Suppress notes on stderr |
| `--timeout <ms>` | Request timeout (default: 15000) |

## Data Source

All data comes from ONPE's public API at `resultadoelectoral.onpe.gob.pe`. No authentication required. Uses Sec-Fetch headers to match browser behavior.

## Built With

7 [cligentic](https://cligentic.railly.dev) blocks: json-mode, next-steps, global-flags, error-map, argv, doctor, banner.

## License

MIT

## Links

- [Website](https://onpe-cli.crafter.run)
- [GitHub](https://github.com/crafter-research/onpe-cli)
- [npm](https://www.npmjs.com/package/@crafter/onpe-cli)
- [Crafter Research](https://github.com/crafter-research)
