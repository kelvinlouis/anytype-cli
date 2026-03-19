# anytype-cli

A command-line interface built around the [Anytype](https://anytype.io/) local API.

The executable for this CLI is **`anyt`** (not `anytype`) to avoid clashing with the official [anytype-cli](https://github.com/anyproto/anytype-cli).

> **Note:** This tool is built around the author's own types and workflows and may not cover all Anytype features or use cases.

## Prerequisites

- Node.js 24+
- [Anytype Desktop](https://anytype.io/) or the [Anytype headless server](https://github.com/anyproto/anytype-cli) running (default API at `http://127.0.0.1:31009`)
- An API key from Anytype Desktop settings

## Installation

```bash
npm install -g @kelvinlouis/anytype-cli
```

## Getting Started

```bash
# Connect to default localhost:31009
anyt init --api-key <your_key>

# Connect to a custom server (e.g. headless Anytype on another host)
anyt init --api-key <your_key> --url http://192.168.1.100:31009
```

This saves your API key (and optionally the server URL) and sets a default space.

## Commands

| Command     | Description                                          |
| ----------- | ---------------------------------------------------- |
| `init`      | Configure API key, server URL, and default space     |
| `types`     | List or inspect object types                         |
| `list`      | List objects by type (with filtering, sorting, etc.) |
| `get`       | Fetch a single object with full details              |
| `create`    | Create a new object (with stdin/template support)    |
| `update`    | Modify an existing object                            |
| `search`    | Full-text search across objects                      |
| `alias`     | Manage short names for type keys                     |
| `fields`    | Manage default columns for `list` output             |
| `templates` | List and inspect templates                           |

### Examples

```bash
# List all objects of a type
anyt list note

# Filter and sort
anyt list task --where "status=In Progress" --sort "created_date:desc"

# Get a specific object
anyt get <object-id>

# Create an object with body from stdin
echo "Hello world" | anyt create note --name "My Note"

# Create from a template
anyt create note --template <template-id>

# Search across all objects
anyt search "meeting notes"

# Set up a type alias
anyt alias set note ot-note

# Configure default fields for a type
anyt fields set note name,created_date,status
```

## Global Options

| Option          | Description                    |
| --------------- | ------------------------------ |
| `--verbose`     | Show detailed output           |
| `--no-color`    | Disable colored output         |
| `--space <id>`  | Override the default space     |
| `--dry-run`     | Preview changes without saving |
| `-v, --version` | Output version number          |

## Key Features

- **Filtering:** `--where`, `--since`, `--linked-to`, `--orphan`
- **Sorting:** `--sort field:asc|desc` with typed comparisons
- **Field selection:** `--fields` with computed fields (`link_count`, `backlink_count`)
- **Stdin piping:** Pipe body content via stdin or `--body -`
- **Type aliases:** Short names for frequently used type keys
- **Per-type default columns:** Configure with `anyt fields set`
- **Template support:** Create objects from templates

## Configuration

Config is stored at `~/.anytype-cli/config.json` and includes:

- `apiKey` — your Anytype API key
- `defaultSpace` — the space to use when `--space` is not provided
- `aliases` — short names mapped to type keys
- `typeFields` — per-type default column configurations
- `baseURL` — API base URL (defaults to `http://127.0.0.1:31009`)

## Contributing

```bash
git clone https://github.com/kelvinlouis/anytype-cli.git
cd anytype-cli
npm install
npm run build
npm link        # makes `anyt` available globally
npm test        # run tests
```

## Agents

See [AGENTS.md](./AGENTS.md) for AI coding agent instructions (Claude, Copilot, Cursor, etc.).

## License

MIT
