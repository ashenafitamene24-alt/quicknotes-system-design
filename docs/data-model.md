# QuickNotes Cloud — Production Data Model & Schema Specification

This document details the relational data architecture, entity definitions, schema constraints, indexing strategy, and database technology selection for **QuickNotes Cloud**.

---

## 1. Entity Definitions & Attribute Specifications

The QuickNotes database consists of four core entities: **`users`**, **`notes`**, **`tags`**, and the associative entity **`note_tags`**.

### Entity Schema Summary

| Table | Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| **`users`** | `id` | `VARCHAR(36)` | `PRIMARY KEY` | Unique UUID identifier for the user account. |
| | `name` | `VARCHAR(100)` | `NOT NULL` | User's display name. |
| | `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | User's unique login email address. |
| | `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id/bcrypt salted password hash. |
| | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Account registration timestamp. |
| | `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Account last modification timestamp. |
| **`notes`** | `id` | `VARCHAR(36)` | `PRIMARY KEY` | Unique UUID identifier for the note. |
| | `user_id` | `VARCHAR(36)` | `NOT NULL, FK -> users(id)` | Foreign key identifying the note owner. |
| | `title` | `VARCHAR(100)` | `NOT NULL` | Required note headline (max 100 characters). |
| | `body` | `TEXT` | `NULL` | Optional long-form markdown note text. |
| | `category` | `VARCHAR(50)` | `NOT NULL DEFAULT 'personal'` | Note classification (`personal`, `work`, `study`). |
| | `pinned` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Flag indicating if note is pinned to top of feed. |
| | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Note creation timestamp. |
| | `updated_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Note last updated timestamp. |
| **`tags`** | `id` | `INT` | `PRIMARY KEY AUTOINCREMENT` | Surrogate integer identifier for the tag. |
| | `name` | `VARCHAR(50)` | `NOT NULL UNIQUE` | Normalized lowercase tag label (e.g., `architecture`). |
| | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Tag initial creation timestamp. |
| **`note_tags`** | `note_id` | `VARCHAR(36)` | `NOT NULL, FK -> notes(id)` | Composite PK & FK referencing the tagged note. |
| | `tag_id` | `INT` | `NOT NULL, FK -> tags(id)` | Composite PK & FK referencing the attached tag. |
| | `created_at` | `TIMESTAMP` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | Association timestamp. |

---

## 2. Entity Relationships

```
+---------------+              +---------------+
|     users     |              |     tags      |
+---------------+              +---------------+
        | 1                            | 1
        |                              |
        | Has many                     | Belongs to many
        v N                            v N
+---------------+   1      N   +---------------+
|     notes     |------------->|   note_tags   |
+---------------+              +---------------+
```

### One-to-Many (1:N) Relationship: `users` &rarr; `notes`
- A single user owns zero, one, or thousands of notes.
- Each individual note belongs strictly to exactly one owning user (`notes.user_id` foreign key referencing `users.id`).
- When a user account is deleted, all their associated notes are automatically deleted via `ON DELETE CASCADE`.

### Many-to-Many (M:N) Relationship: `notes` &harr; `tags`
- A single note can have multiple tags applied (e.g., a note can be tagged with `#architecture`, `#scaling`, and `#backend`).
- A single tag can categorize multiple notes belonging to different or identical users.
- In relational database design, many-to-many relationships cannot be modeled directly within a single column without violating First Normal Form (1NF) or creating severe redundancy. 
- Therefore, the **`note_tags`** associative table bridges the two entities, converting the M:N relationship into two clean 1:N relationships (`notes` &rarr; `note_tags` and `tags` &rarr; `note_tags`) with a composite primary key `PRIMARY KEY (note_id, tag_id)`.

---

## 3. SQL Data Definition Language (DDL)

```sql
-- QuickNotes Cloud Database Schema
-- Compatible with PostgreSQL, MySQL, and SQLite

-- 1. Users Table
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Table
CREATE TABLE notes (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'personal',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tags Table
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Note_Tags Associative Join Table
CREATE TABLE note_tags (
    note_id VARCHAR(36) NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id, tag_id),
    CONSTRAINT fk_notetags_note FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    CONSTRAINT fk_notetags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## 4. Example SQL Queries

### Query 1: Fetch Notes with Aggregated Tags for a User (JOIN)
Retrieves the user's latest 10 notes along with all attached tags formatted as a comma-separated list:

```sql
SELECT 
    n.id AS note_id,
    n.title,
    n.body,
    n.category,
    n.pinned,
    n.created_at,
    GROUP_CONCAT(t.name) AS tags
FROM notes n
LEFT JOIN note_tags nt ON n.id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = 'usr_42019a'
GROUP BY n.id, n.title, n.body, n.category, n.pinned, n.created_at
ORDER BY n.pinned DESC, n.created_at DESC
LIMIT 10 OFFSET 0;
```

### Query 2: Search Notes by Keyword in Title or Body
Finds all notes belonging to a specific user containing a search term (e.g., `'architecture'`) within the title or body:

```sql
SELECT 
    id,
    title,
    body,
    category,
    updated_at
FROM notes
WHERE user_id = 'usr_42019a'
  AND (title LIKE '%architecture%' OR body LIKE '%architecture%')
ORDER BY updated_at DESC;
```

### Query 3: Count of Notes per Tag for a User (GROUP BY & Multi-Table JOIN)
Provides analytics showing how many notes the user has created under each tag:

```sql
SELECT 
    t.name AS tag_name,
    COUNT(nt.note_id) AS total_notes
FROM tags t
JOIN note_tags nt ON t.id = nt.tag_id
JOIN notes n ON nt.note_id = n.id
WHERE n.user_id = 'usr_42019a'
GROUP BY t.id, t.name
ORDER BY total_notes DESC;
```

---

## 5. Indexing Strategy & Performance Rationale

```sql
-- 1. Index on notes for user feed generation
CREATE INDEX idx_notes_user_pinned_created 
ON notes (user_id, pinned DESC, created_at DESC);

-- 2. Index on note_tags for reverse tag queries
CREATE INDEX idx_notetags_tag_id 
ON note_tags (tag_id);

-- 3. Case-insensitive index on user email for login lookups
CREATE INDEX idx_users_email_lower 
ON users (email);
```

### Rationale
- **`idx_notes_user_pinned_created`**: By far the most frequent query in QuickNotes is loading a user's notes feed (`WHERE user_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 10`). Without this compound index, the database must execute a sequential scan of all notes followed by an expensive file-sort. This index allows an index seek directly to the user's notes and returns pre-sorted results in $O(\log N)$ time.
- **`idx_notetags_tag_id`**: The composite primary key `(note_id, tag_id)` automatically indexes queries filtering on `note_id`. However, queries filtering notes by a tag (`WHERE tag_id = ?`) cannot use that index efficiently because `tag_id` is the secondary column. Adding an index on `tag_id` makes tag filtering lightning-fast.

---

## 6. Architectural Decision: SQL vs. NoSQL

For QuickNotes Cloud, **SQL (Relational Database)** is the optimal architectural foundation over NoSQL. 

QuickNotes data is inherently structured with well-defined relational boundaries (users own notes, notes share tags via many-to-many associations). A relational database provides declarative schema enforcement, guarantees strict referential integrity (ensuring no orphaned `note_tags` or dangling user notes remain when records are deleted), and natively supports complex multi-table joins and aggregations. Furthermore, ACID transaction guarantees ensure that concurrent operations (such as simultaneously updating a note, updating its tag mappings, and modifying its timestamp) remain atomic and consistent. 

While NoSQL document stores (such as MongoDB) excel at loose unstructured schemas, modeling a many-to-many relationship in NoSQL requires either embedding tags (causing massive data duplication and severe update anomalies when renaming tags) or executing unindexed application-layer joins. Given our 1 million user scale and read-to-write profile, a normalized SQL database combined with an in-memory caching tier delivers superior data integrity, query flexibility, and operational maintainability.
