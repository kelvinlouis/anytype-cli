# Anytype CLI Implementation Plan

> A CLI tool optimized for AI agent tool calling to interact with Anytype objects.

## Overview

### Purpose

Build a CLI that enables AI agents to read and manage Anytype objects through structured commands. The CLI will be the interface layer between AI tools (like Goose recipes, Claude skills) and the Anytype knowledge base.

### Primary Use Cases

1. **1:1 Meeting Preparation** - Gather team member notes, goals, previous meetings
2. **Quick Capture** - Create notes linked to team members or areas
3. **Reading List Management** - Track articles/books with read status
4. **Orphan Note Detection** - Find unlinked notes for triage
5. **Property Updates** - Change mood, status, ratings on objects
6. **Daily/Weekly Reflection** - Review and capture team lead reflections

### Target User

- Personal use by a team lead using PARA method
- Designed for AI agent consumption (tool calling)
- Future: generalizable for other users

---

## Tech Stack

| Component         | Choice                      | Rationale                                 |
| ----------------- | --------------------------- | ----------------------------------------- |
| Runtime           | Node.js 24                  | User preference, async-friendly           |
| Language          | TypeScript                  | Type safety, better IDE support           |
| CLI Framework     | Commander.js                | Most popular, well-maintained, simple API |
| HTTP Client       | Native fetch (Node 24)      | No dependencies, built-in                 |
| Config Management | conf                        | Simple, cross-platform config storage     |
| Output Formatting | marked (md→terminal), chalk | Markdown rendering, colors                |
| Testing           | Vitest                      | Fast, TypeScript-native                   |
| Build             | tsup                        | Simple TypeScript bundler                 |

### Project Structure

```
anytype-cli/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── cli/
│   │   ├── commands/         # Command implementations
│   │   │   ├── init.ts
│   │   │   ├── types.ts
│   │   │   ├── list.ts
│   │   │   ├── get.ts
│   │   │   ├── create.ts
│   │   │   ├── update.ts
│   │   │   └── search.ts
│   │   ├── flags.ts          # Shared flag definitions
│   │   └── output.ts         # Output formatters (md/json)
│   ├── api/
│   │   ├── client.ts         # Anytype API client
│   │   ├── types.ts          # API type definitions
│   │   ├── objects.ts        # Object operations
│   │   ├── spaces.ts         # Space operations
│   │   └── search.ts         # Search operations
│   ├── config/
│   │   ├── index.ts          # Config management
│   │   └── aliases.ts        # Type alias resolution
│   └── utils/
│       ├── errors.ts         # Error handling, exit codes
│       └── date.ts           # Date parsing utilities
├── package.json
├── tsconfig.json
└── README.md
```

---

## API Reference Summary

Base URL: `http://127.0.0.1:31009` (Anytype local API)

### Authentication

- Header: `Authorization: Bearer <api_key>`
- API key generated from Anytype Desktop: Settings → API Keys

### Key Endpoints

| Method | Endpoint                             | Purpose             |
| ------ | ------------------------------------ | ------------------- |
| GET    | `/v1/spaces`                         | List all spaces     |
| GET    | `/v1/spaces/{space_id}/types`        | List types in space |
| GET    | `/v1/spaces/{space_id}/objects`      | List objects        |
| GET    | `/v1/spaces/{space_id}/objects/{id}` | Get single object   |
| POST   | `/v1/spaces/{space_id}/objects`      | Create object       |
| PATCH  | `/v1/spaces/{space_id}/objects/{id}` | Update object       |
| DELETE | `/v1/spaces/{space_id}/objects/{id}` | Archive object      |
| POST   | `/v1/search`                         | Global search       |

### Object Structure

```json
{
  "id": "string",
  "name": "string",
  "icon": "string",
  "type_key": "string",
  "body": "markdown string",
  "properties": {
    "key": "value"
  },
  "created_at": "ISO date",
  "updated_at": "ISO date"
}
```

---

## Phase 1: Foundation

**Goal:** Establish project structure, API client, and configuration management.

### Tasks

#### 1.1 Project Setup

- [ ] Initialize npm project with TypeScript
- [ ] Configure tsconfig.json for ES modules
- [ ] Set up tsup for building
- [ ] Configure package.json bin entry for `anytype` command
- [ ] Add Vitest for testing

**Acceptance Criteria:**

- Running `npm run build` produces executable in `dist/`
- Running `npx anytype --version` outputs version number
- Running `npm test` executes test suite (even if empty)

#### 1.2 Configuration Management

- [ ] Create config module using `conf` package
- [ ] Support storing: `apiKey`, `defaultSpace`, `aliases`
- [ ] Config location: `~/.anytype-cli/config.json`
- [ ] Add `getConfig()`, `setConfig()`, `hasConfig()` functions

**Acceptance Criteria:**

- Config file is created at correct location
- Values persist between CLI invocations
- Missing config returns sensible defaults

#### 1.3 API Client Core

- [ ] Create typed API client with base URL configuration
- [ ] Implement Bearer token authentication
- [ ] Add request/response error handling
- [ ] Create TypeScript interfaces for API responses
- [ ] Handle connection errors (Anytype not running)

**Acceptance Criteria:**

- Client can make authenticated GET request to `/v1/spaces`
- Connection errors produce clear error message
- 401 errors indicate invalid API key
- All responses are properly typed

#### 1.4 Error Handling & Exit Codes

- [ ] Define exit code constants:
  - `0` - Success
  - `1` - General error
  - `2` - Configuration error (missing API key)
  - `3` - Connection error (Anytype not running)
  - `4` - Not found
  - `5` - Validation error
- [ ] Create error classes for each type
- [ ] Implement global error handler

**Acceptance Criteria:**

- Each error type exits with correct code
- Error messages are concise and actionable
- `--verbose` flag shows stack traces

### Phase 1 Deliverables

- Working build pipeline
- Config management operational
- API client connects to Anytype
- Error handling with exit codes

---

## Phase 2: Core Read Commands

**Goal:** Implement commands to read and discover data from Anytype.

### Tasks

#### 2.1 CLI Framework Setup

- [ ] Initialize Commander.js program
- [ ] Add global flags: `--json`, `--verbose`, `--space`
- [ ] Set up command routing structure
- [ ] Implement help text generation

**Acceptance Criteria:**

- `anytype --help` shows available commands
- `anytype <command> --help` shows command-specific help
- Global flags are accessible in all commands

#### 2.2 `anytype init` Command

- [ ] Prompt for API key (or accept via flag)
- [ ] Validate API key by calling `/v1/spaces`
- [ ] Fetch available spaces and prompt for default
- [ ] Save configuration
- [ ] Display success message with next steps

**Acceptance Criteria:**

- Running `anytype init` with valid key creates config
- Invalid API key shows clear error
- Subsequent commands use stored config
- `anytype init --api-key <key>` works non-interactively

#### 2.3 `anytype types` Command

- [ ] Fetch types from `/v1/spaces/{space_id}/types`
- [ ] Display type name, key, and property count
- [ ] Support `--json` output
- [ ] Cache types locally for faster alias resolution

**Acceptance Criteria:**

- `anytype types` lists all types in default space
- Output shows type keys needed for other commands
- `anytype types --json` returns valid JSON array

#### 2.4 `anytype list <type>` Command

- [ ] Resolve type aliases (e.g., `1on1` → actual type key)
- [ ] Fetch objects from `/v1/spaces/{space_id}/objects?type_key=X`
- [ ] Display as markdown table: name, id, updated date
- [ ] Support flags:
  - `--linked-to <name>` - Filter by relation
  - `--since <date>` - Filter by date
  - `--limit <n>` - Limit results
  - `--fields <list>` - Select specific properties
- [ ] Support `--json` output

**Acceptance Criteria:**

- `anytype list team-member` shows all team members
- `anytype list 1on1 --linked-to "John"` filters correctly
- `anytype list notes --since 2025-01-01` filters by date
- Output is clean markdown by default
- `--json` returns array of objects

#### 2.5 `anytype get <type> <identifier>` Command

- [ ] Support lookup by ID or name
- [ ] Fetch full object including body
- [ ] Format markdown body for terminal display
- [ ] Show linked objects/relations
- [ ] Support `--json` output

**Acceptance Criteria:**

- `anytype get team-member "John Doe"` returns full object
- `anytype get note abc123` works with ID
- Markdown body renders properly in terminal
- Related objects are listed
- `--json` returns complete object structure

#### 2.6 `anytype search <query>` Command

- [ ] Call global search endpoint
- [ ] Support `--type` filter
- [ ] Support `--limit` and `--offset` for pagination
- [ ] Display results as markdown list

**Acceptance Criteria:**

- `anytype search "project alpha"` returns matching objects
- `anytype search "meeting" --type note` filters by type
- Results show name, type, and snippet

### Phase 2 Deliverables

- All read commands operational
- Type alias resolution working
- Markdown and JSON output modes
- Filtering by relations and dates

---

## Phase 3: Write Commands

**Goal:** Implement commands to create and update objects.

### Tasks

#### 3.1 `anytype create <type>` Command

- [ ] Accept name as positional argument or flag
- [ ] Support `--body` for markdown content
- [ ] Support `--body-file` to read from file
- [ ] Support `--property key=value` for properties (repeatable)
- [ ] Support `--link-to <id>` to create relations
- [ ] Implement `--dry-run` to preview without creating
- [ ] Return created object ID on success

**Acceptance Criteria:**

- `anytype create note "Daily Standup" --body "## Notes"` creates note
- `anytype create task "Review PR" --link-to abc123` links to object
- `anytype create 1on1 "John 1:1" --property date=2025-01-20 --dry-run` shows preview
- Created object ID is output (useful for piping)
- Exit code 0 on success

#### 3.2 `anytype update <identifier>` Command

- [ ] Lookup object by ID or name
- [ ] Support `--name` to rename
- [ ] Support `--body` to replace body
- [ ] Support `--append` to append to body
- [ ] Support `--property key=value` to update properties
- [ ] Support `--link-to` and `--unlink-from` for relations
- [ ] Implement `--dry-run` flag

**Acceptance Criteria:**

- `anytype update abc123 --property mood=happy` updates property
- `anytype update "John Doe" --append "## New Section"` appends to body
- `anytype update note123 --link-to member456` creates relation
- `--dry-run` shows diff of changes
- Exit code 0 on success, 4 if not found

#### 3.3 Input Validation

- [ ] Validate type exists before create
- [ ] Validate required properties for type
- [ ] Validate date formats
- [ ] Validate property values against type schema

**Acceptance Criteria:**

- Invalid type shows available types
- Missing required property shows clear error
- Invalid date format shows expected format

### Phase 3 Deliverables

- Create and update commands working
- Dry-run mode for safe testing
- Property and relation management
- Input validation with helpful errors

---

## Phase 4: Advanced Features & Polish

**Goal:** Add convenience features, improve UX, and prepare for release.

### Tasks

#### 4.1 Alias Management

- [ ] Implement `anytype alias` command
  - `anytype alias list` - Show all aliases
  - `anytype alias set <alias> <type_key>` - Create alias
  - `anytype alias remove <alias>` - Remove alias
- [ ] Pre-populate sensible defaults on init:
  - `team`, `member` → team_member type
  - `1on1` → one_on_one type
  - `goal`, `goals` → team_member_goal type
  - `mag` → appraisal type
  - `training`, `education` → team_member_training type

**Acceptance Criteria:**

- `anytype alias list` shows all configured aliases
- `anytype list member` works after alias is set
- Aliases persist in config file

#### 4.2 Output Formatting Improvements

- [ ] Add `--fields` flag to select specific properties
- [ ] Add `--format` flag for custom output templates
- [ ] Improve markdown table rendering
- [ ] Add color coding for types and status

**Acceptance Criteria:**

- `anytype list tasks --fields name,status,due_date` shows only those
- Output is visually clean and readable
- Colors can be disabled with `--no-color` or `NO_COLOR` env

#### 4.3 Help & Documentation

- [ ] Generate comprehensive help for each command
- [ ] Add examples to help text
- [ ] Create `anytype help` as alias for `--help`
- [ ] Add `anytype help <command>` support

**Acceptance Criteria:**

- Every command has usage examples in help
- `anytype help create` shows detailed create documentation
- Help text explains AI agent usage patterns

#### 4.4 Orphan Detection

- [ ] Implement `anytype list notes --orphan` flag
- [ ] Detect notes with no links and no backlinks
- [ ] Optionally filter by age (`--older-than 7d`)

**Acceptance Criteria:**

- `anytype list notes --orphan` shows unlinked notes
- Can combine with date filters
- Output suitable for triage workflow

#### 4.5 Stdin Support

- [ ] Support reading body from stdin
- [ ] Enable piping: `echo "content" | anytype create note "Title"`
- [ ] Support `--body -` to read from stdin

**Acceptance Criteria:**

- `cat notes.md | anytype create note "Imported"` works
- `anytype get note abc123 | anytype update xyz789 --body -` pipes content

#### 4.6 Testing & Quality

- [ ] Unit tests for API client
- [ ] Unit tests for alias resolution
- [ ] Integration tests for commands (mocked API)
- [ ] Test exit codes for all error scenarios

**Acceptance Criteria:**

- Test coverage > 80%
- All commands have at least one test
- CI can run tests without Anytype running

### Phase 4 Deliverables

- Alias management complete
- Rich formatting options
- Comprehensive help system
- Orphan note detection
- Stdin/pipe support
- Test suite

---

## Command Reference

### Global Flags

| Flag            | Description                        |
| --------------- | ---------------------------------- |
| `--json`        | Output as JSON instead of markdown |
| `--verbose, -v` | Show detailed output and errors    |
| `--space <id>`  | Override default space             |
| `--no-color`    | Disable colored output             |
| `--dry-run`     | Preview changes without executing  |

### Commands

#### `anytype init`

```bash
anytype init [--api-key <key>]
```

Set up configuration with API key and default space.

#### `anytype types`

```bash
anytype types [--json]
```

List all object types in the space.

#### `anytype list <type>`

```bash
anytype list <type> [--linked-to <name>] [--since <date>] [--limit <n>] [--fields <list>] [--orphan]
```

List objects of a given type with optional filters.

#### `anytype get <type> <identifier>`

```bash
anytype get <type> <identifier> [--json]
```

Get full object details including body content.

#### `anytype create <type>`

```bash
anytype create <type> <name> [--body <md>] [--body-file <path>] [--property key=value]... [--link-to <id>]
```

Create a new object.

#### `anytype update <identifier>`

```bash
anytype update <identifier> [--name <new>] [--body <md>] [--append <md>] [--property key=value]... [--link-to <id>] [--unlink-from <id>]
```

Update an existing object.

#### `anytype search <query>`

```bash
anytype search <query> [--type <type>] [--limit <n>]
```

Search across all objects.

#### `anytype alias`

```bash
anytype alias list
anytype alias set <alias> <type_key>
anytype alias remove <alias>
```

Manage type aliases.

---

## Exit Codes

| Code | Meaning                                               |
| ---- | ----------------------------------------------------- |
| 0    | Success                                               |
| 1    | General error                                         |
| 2    | Configuration error (missing API key, invalid config) |
| 3    | Connection error (Anytype not running)                |
| 4    | Not found (object, type, or space doesn't exist)      |
| 5    | Validation error (invalid input)                      |

---

## AI Agent Usage Examples

### Prepare 1:1 Meeting

```bash
# Get team member info
anytype get team-member "John Doe" --json

# Get recent 1:1s
anytype list 1on1 --linked-to "John Doe" --since 2024-06-01 --json

# Get goals
anytype list goal --linked-to "John Doe" --json

# Get training records
anytype list training --linked-to "John Doe" --json

# Get related notes
anytype search "John" --type note --json
```

### Quick Capture

```bash
# Create note linked to team member
anytype create note "Observation: John's presentation" \
  --body "Noticed excellent stakeholder communication" \
  --link-to john_doe_id
```

### Daily Reflection

```bash
# Get today's meetings and notes
anytype list note --since today --json
anytype list 1on1 --since today --json

# Create reflection
anytype create note "Reflection 2025-01-23" \
  --body "## Reflections\n\n- ..." \
  --property tag=reflection \
  --link-to line_management_area_id
```

### Find Orphan Notes

```bash
anytype list notes --orphan --older-than 7d
```

---

## Future Considerations (Out of Scope)

- Multi-space workflows
- Batch operations with query-based updates
- Watch mode for real-time sync
- Plugin system for custom commands
- Web-based alternative to local API
