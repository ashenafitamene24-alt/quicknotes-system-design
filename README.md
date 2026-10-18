# QuickNotes Cloud — System Design & API Client

A production-grade system architecture, database schema, and interactive REST API client for **QuickNotes Cloud**, scaling the note-taking platform from an in-browser prototype to an enterprise cloud service supporting 1,000,000 users.

---

## 📖 Overview

As Lead Engineer for QuickNotes, this repository delivers the complete blueprint for transitioning QuickNotes from a browser-only, client-side application into a resilient, scalable online service. 

This project encompasses two core engineering tracks:
1. **Interactive Frontend API Client**: A zero-dependency HTML5, CSS3, and JavaScript client interfacing with RESTful endpoints, proving robust asynchronous communication (GET, POST, DELETE), comprehensive state management (loading, success, error, and empty states), client-side input validation, and defensive DOM manipulation.
2. **Production System Design Documentation**: Comprehensive architectural specifications for backend and platform engineering teams, covering REST API design, normalized relational data modeling, capacity planning for 1M users, high-availability infrastructure, and single point of failure (SPOF) mitigation.

---

## 📑 System Design Documentation

The complete architectural specifications are organized within the [`docs/`](docs/) directory:

- 📡 **[API Design Document](docs/api-design.md)**: Full REST API specification featuring 7 endpoints, request and response JSON payloads for note creation and listing, authentication protocols (JWT), and standard error status codes (`400`, `401`, `403`, `404`, `500`) with example error bodies.
- 🗄️ **[Data Model Document](docs/data-model.md)**: Relational schema specification covering four core entities (`users`, `notes`, `tags`, `note_tags`), relationship modeling (1:N and M:N via join tables), complete SQL DDL statements, multi-table queries with `JOIN` and `GROUP BY`, targeted indexing strategies, and an in-depth justification for choosing SQL over NoSQL.
- 🏗️ **[Architecture & Scaling Plan](docs/architecture.md)**: High-level cloud architecture designed for 1,000,000 users. Includes quantitative throughput calculations (23.15 read QPS, 2.31 write QPS, 328.5 GB/year storage), a detailed ASCII infrastructure diagram (Client, DNS, CDN, Load Balancer, App Servers, Redis Cache, Primary/Replica SQL Databases, Message Queue, and Worker Service), step-by-step request execution flows for `GET` and `POST`, architectural trade-offs, and strategies to eliminate single points of failure.

---

## 🚀 How to Run the API Client

No compilers, heavy bundlers, or third-party dependencies are required. The API client runs natively in any modern web browser.

### Option 1: Direct File Launch
1. Clone this repository:
   ```bash
   git clone https://github.com/ashenafitamene24-alt/quicknotes-system-design.git
   ```
2. Navigate into the project directory:
   ```bash
   cd quicknotes-system-design
   ```
3. Open `index.html` directly in your browser (double-click the file or open via browser menu).

### Option 2: Using a Local Development Server
From the root directory of the repository:

- **Using Python 3**:
  ```bash
  python -m http.server 8000
  ```
  Visit `http://localhost:8000` in your browser.

- **Using Node.js**:
  ```bash
  npx serve .
  ```
  or
  ```bash
  npx live-server
  ```

---

## 🧪 Testing the API Client Features

1. **Load Notes (`GET`)**: Click the **Load notes** button. The button is disabled and `#status` displays `"Loading notes..."`. Upon resolution, 10 notes are populated from the API and the status displays `"Loaded 10 notes from the server."`.
2. **Create Note (`POST`)**: Fill in the title and optional body. Submitting validates that the title is present and $\le 100$ characters. The submit button is disabled during the request. Upon receiving the `201 Created` response, the new note is prepended to the top of the list, the form resets, and `#status` confirms: `"Note created (status 201, id 101)."`.
3. **Delete Note (`DELETE`)**: Click the **Delete** button on any note card. The button is disabled while issuing `DELETE /posts/{id}`. Upon success, the note is removed from the DOM and `#status` updates with confirmation. If all notes are removed, a clean empty-state message appears.

---

## 💡 What I Learned

During the design and implementation of QuickNotes Cloud, several fundamental software and systems engineering principles were reinforced:

1. **Defensive Asynchronous UI & Safe DOM Manipulation**:
   Building a reliable API client requires accounting for all network lifecycle states—loading, success, error, and empty lists. Disabling action buttons during in-flight requests prevents race conditions and accidental duplicate submissions. Enforcing the strict use of `document.createElement()` and `textContent` rather than `innerHTML` ensures that untrusted user data is treated strictly as text nodes, completely eliminating Cross-Site Scripting (XSS) vulnerabilities.

2. **Relational Data Normalization & Associative Modeling**:
   Designing the data model highlighted why many-to-many relationships must be resolved through an associative join table (`note_tags`). Attempting to embed comma-separated tags directly into notes violates First Normal Form (1NF) and breaks search indexing. Using composite primary keys `PRIMARY KEY (note_id, tag_id)` with cascading foreign keys guarantees referential integrity, eliminates orphaned records, and enables efficient bidirectional queries between notes and tags.

3. **High-Availability Architecture & Decoupled Scaling**:
   Designing a system to serve 1,000,000 users underscored the power of tier decoupling. Offloading repetitive reads from the Primary Database to an in-memory Redis cache and Read Replicas ensures sub-50ms response times. Meanwhile, using a message queue to process heavy background tasks (such as search re-indexing and tag analytics) asynchronously guarantees that user-facing API response times remain fast without getting blocked by auxiliary computations.
