# QuickNotes Cloud — High-Level System Architecture & Scaling Plan

This architectural specification details the transition of **QuickNotes** from an in-browser local prototype to a production-grade, highly available cloud platform engineered for 1 million registered users.

---

## 1. System Requirements

### A. Functional Requirements
1. **User Authentication & Session Management**: Secure user registration, password hashing (Argon2id), login, and stateless JWT token-based authorization.
2. **Full Note Lifecycle (CRUD)**: Create, retrieve, update, and delete notes with rich markdown support, character limits (max 100 chars for title), and categories.
3. **Real-Time Search & Tagging**: Full-text keyword search across titles/bodies and filtering by categorized tags.
4. **Note Organization**: Ability to pin priority notes to the top of the user's feed.
5. **Asynchronous Background Processing**: Offloading heavy asynchronous tasks (search engine re-indexing, notification dispatching, backup generation) via message queues.

### B. Non-Functional Requirements
1. **Availability**: **99.9% uptime** (Three Nines), permitting less than 8.76 hours of total downtime annually across planned and unplanned maintenance.
2. **Low Latency**:
   - Feed Reads (`GET /notes`): $p95 < 50\text{ ms}$ (cached), $p95 < 120\text{ ms}$ (uncached).
   - Note Writes (`POST /notes`): $p95 < 150\text{ ms}$.
3. **Scalability**: Seamlessly handle 1,000,000 registered accounts and 100,000 Daily Active Users (DAU) with 5× peak traffic spikes.
4. **Data Durability & Reliability**: Zero data loss for committed notes ($RPO = 0$, $RTO < 5\text{ minutes}$) through automated WAL replication and daily snapshot backups.
5. **Security**: Mandatory TLS 1.3 encryption in transit, AES-256 encryption at rest, parameterized queries preventing SQL injection, and sanitization defense against XSS.

---

## 2. Capacity Planning & Load Estimates (1 Million Users)

### Baseline Parameters
- **Registered Users**: 1,000,000
- **Daily Active Users (DAU)**: 10% = 100,000 active users/day
- **User Activity**:
  - **Reads**: 20 note list / search views per active user/day
  - **Writes**: 2 note creations or updates per active user/day
- **Peak Multiplier**: 5× average throughput
- **Seconds per Day**: 86,400

---

### Quantitative Throughput Calculations

#### A. Read Requests per Second
- **Total Daily Reads**:
  $$100,000 \text{ DAU} \times 20 \text{ views/day} = 2,000,000 \text{ read requests/day}$$
- **Average Read QPS**:
  $$\frac{2,000,000}{86,400} \approx \mathbf{23.15 \text{ queries/sec}}$$
- **Peak Read QPS (5×)**:
  $$23.15 \times 5 \approx \mathbf{115.74 \text{ queries/sec}}$$

#### B. Write Requests per Second
- **Total Daily Writes**:
  $$100,000 \text{ DAU} \times 2 \text{ writes/day} = 200,000 \text{ write requests/day}$$
- **Average Write QPS**:
  $$\frac{200,000}{86,400} \approx \mathbf{2.31 \text{ queries/sec}}$$
- **Peak Write QPS (5×)**:
  $$2.31 \times 5 \approx \mathbf{11.57 \text{ queries/sec}}$$

#### C. Storage Growth per Year
- **Average Note Record Footprint**:
  - Title: 100 bytes
  - Body: 1,000 bytes (1 KB)
  - Metadata, UUIDs, Category, Timestamps: 200 bytes
  - Total per note: $\approx 1.3\text{ KB}$ (conservatively modeled at **1.5 KB**).
- **Annual Note Additions**:
  $$200,000 \text{ notes/day} \times 365 \text{ days} = 73,000,000 \text{ notes/year}$$
- **Raw Data Storage**:
  $$73,000,000 \times 1.5 \text{ KB} \approx 109,500,000 \text{ KB} \approx \mathbf{109.5 \text{ GB/year}}$$
- **Total Storage with Indexes & Replicas (3× Factor)**:
  $$109.5 \text{ GB} \times 3 \approx \mathbf{328.5 \text{ GB/year}}$$

---

## 3. Architecture Diagram

```
                                +--------------------+
                                |     End Users      |
                                |  (Browser/Mobile)  |
                                +---------+----------+
                                          |
                                          v
                                +--------------------+
                                |     DNS Layer      |
                                | (Route 53/Cloudfl) |
                                +---------+----------+
                                          |
                     +--------------------+--------------------+
                     | (Static Web Assets)                     | (Dynamic REST API Requests)
                     v                                         v
            +-----------------+                       +-----------------+
            |   Global CDN    |                       |  Load Balancer  |
            | (HTML/CSS/JS)   |                       | (Nginx/AWS ALB) |
            +-----------------+                       +--------+--------+
                                                               |
                                     +-------------------------+-------------------------+
                                     |                                                   |
                                     v                                                   v
                           +-------------------+                               +-------------------+
                           |   App Server 1    |                               |   App Server 2    |
                           | (Node/Go/Python)  |                               | (Node/Go/Python)  |
                           +---+-----------+---+                               +---+-----------+---+
                               |           |                                       |           |
             +-----------------+           +-------------------+ +-----------------+           |
             |                                                 | |                             |
             v                                                 v v                             v
    +------------------+                              +------------------+            +------------------+
    | In-Memory Cache  |                              | Primary Database |            |  Message Queue   |
    | (Redis Cluster)  |                              |   (SQL Master)   |            | (RabbitMQ / SQS) |
    +------------------+                              +--------+---------+            +--------+---------+
                                                               |                               |
                                                               | Async Sync                    | (Job Consume)
                                                               v                               v
                                                      +------------------+            +------------------+
                                                      |  Read Replica    |            |  Worker Service  |
                                                      |   (SQL Slave)    |            | (Search/Index)   |
                                                      +------------------+            +------------------+
```

---

## 4. Component Breakdown (One Sentence Per Component)

1. **Client (Browser / Mobile)**: Presents the user interface, manages client-side form validation, and communicates securely with backend services via REST APIs.
2. **DNS (Domain Name System)**: Translates the human-friendly domain `quicknotes.io` into server IP addresses using latency-based routing and health checks.
3. **Content Delivery Network (CDN)**: Caches static frontend assets (`index.html`, `style.css`, `api.js`) at global edge locations to eliminate web server load and accelerate page loads.
4. **Load Balancer (Nginx / ALB)**: Distributes incoming API requests uniformly across backend application instances and performs continuous health checks to redirect traffic away from failed nodes.
5. **App Servers (Server 1 & 2 Cluster)**: Executes stateless application logic, authenticates JWT tokens, enforces business validation rules, and queries databases and cache layers.
6. **In-Memory Cache (Redis)**: Stores pre-serialized user note feeds and active user sessions in RAM to satisfy read queries with sub-millisecond latency and offload database reads.
7. **Primary Database (SQL Master)**: Serves as the single authoritative source of truth for all transactional writes, relational integrity constraints, and user accounts.
8. **Read Replica Database (SQL Slave)**: Continuously synchronizes with the primary database to serve heavy read and search queries, scaling read capacity independently.
9. **Message Queue (RabbitMQ / SQS)**: Buffers non-critical background jobs (e.g., full-text search indexing, tag analytics) to ensure API response times remain instantaneous for users.
10. **Background Worker Service**: Consumes asynchronous tasks from the message queue, performs heavy indexing and analytics computations, and updates background data stores.

---

## 5. Step-by-Step Request Flows

### Flow A: `GET /notes` (Listing Notes)
1. **User Action**: The client clicks "Load notes" or opens the application, triggering a `GET /api/v1/notes` request with their JWT Bearer token.
2. **Routing**: The **DNS** directs the call to the **Load Balancer**, which terminates SSL/TLS and forwards the request to an available **App Server**.
3. **Authentication**: The **App Server** validates the JWT token, extracts the `user_id`, and checks rate limits.
4. **Cache Lookup**: The **App Server** queries the **Redis Cache** for the key `user:{user_id}:notes:page:1`.
   - **Cache Hit**: If present, the App Server immediately returns the cached JSON list to the client ($<15\text{ ms}$).
   - **Cache Miss**: If absent, the App Server queries the **Read Replica Database** executing `SELECT ... FROM notes WHERE user_id = ? ORDER BY pinned DESC, created_at DESC LIMIT 10`.
5. **Cache Population**: The **App Server** writes the retrieved SQL records into **Redis** with a 15-minute Time-To-Live (TTL).
6. **Response**: The **App Server** returns HTTP `200 OK` with the note array to the client.

---

### Flow B: `POST /notes` (Creating a Note)
1. **User Action**: The user fills out the note form and submits, issuing a `POST /api/v1/notes` request with `{ title, body, category }`.
2. **Routing & Validation**: The **Load Balancer** routes the request to an **App Server**, which verifies the JWT token and validates that `title` is present and $\le 100$ characters.
3. **Database Write**: The **App Server** generates a UUID for the new note and executes an `INSERT INTO notes (...)` transaction on the **Primary Database**.
4. **Cache Invalidation**: Upon successful commit, the **App Server** invalidates the user's cached feed keys in **Redis** (`DEL user:{user_id}:notes:*`).
5. **Job Dispatch**: The **App Server** publishes an asynchronous event `{ event: "NOTE_CREATED", noteId: "note_123" }` into the **Message Queue**.
6. **Immediate Response**: The **App Server** immediately responds with HTTP `201 Created` and the new note JSON payload so the user does not wait for background tasks.
7. **Background Worker Execution**: The **Worker Service** picks up the event from the queue, extracts keywords, and updates the search index and tag analytics asynchronously.

---

## 6. Architectural Trade-Offs & Single Points of Failure (SPOF)

### Trade-Off 1: Cache-Aside with Invalidation vs. Write-Through Caching
- **Decision**: Implementing **Cache-Aside (Lazy Loading)** with explicit cache eviction on writes.
- **Advantage**: High memory efficiency; only notes belonging to currently active users reside in expensive RAM. Unused notes do not waste cache memory.
- **Downside**: Cache misses incur a penalty (one roundtrip to Redis followed by a database read). Furthermore, concurrent updates require careful invalidation to prevent serving stale data.

### Trade-Off 2: Synchronous Processing vs. Asynchronous Message Queues
- **Decision**: Decoupling non-critical tasks (search indexing, tag count recalculation) into an asynchronous **Message Queue**.
- **Advantage**: Protects the client-facing API response time ($<100\text{ ms}$) and isolates the main database from spike loads during heavy search indexing.
- **Downside**: Introduces **eventual consistency**; a newly created note might take 500ms to appear in full-text search results while the worker processes the queue.

---

### Eliminating Single Points of Failure (SPOF)

| Component | Potential Failure Mode | High Availability & Redundancy Strategy |
| :--- | :--- | :--- |
| **DNS Layer** | DNS outage breaks routing. | Multi-provider Anycast DNS (AWS Route 53 with automated Cloudflare secondary fallback). |
| **Load Balancer** | Load balancer instance failure. | Redundant active-passive Load Balancer cluster using Virtual Router Redundancy Protocol (VRRP) / AWS Managed ALB with automated cross-AZ failover. |
| **App Servers** | A server crashes or runs out of memory. | Stateless application design deployed across multiple Availability Zones (AZs) behind an Auto-Scaling Group (minimum of 2 instances running at all times). |
| **Cache Layer** | Redis node goes down. | Redis Sentinel / Redis Cluster with multi-replica setup and automated primary election. Application falls back gracefully to SQL on cache unavailability. |
| **Primary Database** | Hardware failure on write master. | Multi-AZ synchronous standby replication. If the Primary fails, the automated orchestrator promotes the Read Replica to Primary within 30 seconds. |
| **Message Queue** | Broker crashes losing jobs. | Clustered RabbitMQ or managed AWS SQS with durable, disk-persisted queues and dead-letter queues (DLQ) for failed jobs. |
