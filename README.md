# anytype-cli

A command-line interface built around the [Anytype](https://anytype.io/) local API.

> **Note:** This is a personal/internal tool and is not published to npm. It is built around the author's own types and workflows and may not cover all Anytype features or use cases.

## Prerequisites

- Node.js 18+
- [Anytype Desktop](https://anytype.io/) running (exposes local API on `http://127.0.0.1:31009`)
- An API key from Anytype Desktop settings

## Installation

This package is not published to npm — `npm install -g anytype-cli` will not work. To install, clone the repo and link it locally. See [Contributing](#contributing) for instructions.

## Getting Started

```bash
anytype init --api-key <your_key>
```

This saves your API key and lets you select a default space.

## Commands

| Command     | Description                                          |
| ----------- | ---------------------------------------------------- |
| `init`      | Configure API key and default space                  |
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
anytype list note

# Filter and sort
anytype list task --where "status=In Progress" --sort "created_date:desc"

# Get a specific object
anytype get <object-id>

# Create an object with body from stdin
echo "Hello world" | anytype create note --name "My Note"

# Create from a template
anytype create note --template <template-id>

# Search across all objects
anytype search "meeting notes"

# Set up a type alias
anytype alias set note ot-note

# Configure default fields for a type
anytype fields set note name,created_date,status
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
- **Per-type default columns:** Configure with `anytype fields set`
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
npm link        # makes `anytype` available globally
npm test        # run tests
```

## Agents

See [AGENTS.md](./AGENTS.md) for AI coding agent instructions (Claude, Copilot, Cursor, etc.).

## License

MIT
