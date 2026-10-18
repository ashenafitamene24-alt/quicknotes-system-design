# QuickNotes Cloud — Production REST API Specification

This document defines the formal RESTful API specification for the **QuickNotes Cloud** backend service. It serves as the single source of truth for the backend engineering team building the production APIs to replace the client-side mock implementation.

---

## 1. Authentication & Base URL

- **Base URL**: `https://api.quicknotes.io/api/v1`
- **Protocol**: HTTPS only
- **Authentication**: Bearer Token (JSON Web Token — JWT) in the `Authorization` header:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Content-Type**: `application/json; charset=UTF-8`

---

## 2. API Endpoints Table

| Method | Path | Description | Success Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notes` | List paginated notes for the authenticated user (supports search & filters). | `200 OK` |
| `GET` | `/api/v1/notes/{id}` | Retrieve complete details of a single note by its ID. | `200 OK` |
| `POST` | `/api/v1/notes` | Create a new note associated with the authenticated user. | `201 Created` |
| `PUT` | `/api/v1/notes/{id}` | Replace/update an entire note record. | `200 OK` |
| `PATCH` | `/api/v1/notes/{id}` | Partially update specific fields (e.g., title, body, pinned, category). | `200 OK` |
| `DELETE` | `/api/v1/notes/{id}` | Permanently delete a note by its ID. | `204 No Content` |
| `GET` | `/api/v1/notes/tags/{tag}` | Filter notes by a specific tag label. | `200 OK` |

---

## 3. Request & Response Payload Examples

### A. Creating a Note (`POST /api/v1/notes`)

#### Request
- **Method & Path**: `POST /api/v1/notes`
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...
  ```
- **Request Body**:
  ```json
  {
    "title": "System Architecture Review",
    "body": "Discussed database sharding, Redis cache replication, and horizontal scaling strategies for 1M DAU.",
    "category": "work",
    "tags": ["architecture", "scaling", "backend"],
    "pinned": true
  }
  ```

#### Response
- **Status**: `201 Created`
- **Headers**:
  ```http
  Location: /api/v1/notes/note_8f9c1a7b
  Content-Type: application/json; charset=UTF-8
  ```
- **Response Body**:
  ```json
  {
    "id": "note_8f9c1a7b",
    "userId": "usr_42019a",
    "title": "System Architecture Review",
    "body": "Discussed database sharding, Redis cache replication, and horizontal scaling strategies for 1M DAU.",
    "category": "work",
    "tags": ["architecture", "scaling", "backend"],
    "pinned": true,
    "createdAt": "2026-10-18T10:30:00Z",
    "updatedAt": "2026-10-18T10:30:00Z"
  }
  ```

---

### B. Listing Notes (`GET /api/v1/notes`)

#### Request
- **Method & Path**: `GET /api/v1/notes?page=1&limit=10&search=architecture&category=work`
- **Headers**:
  ```http
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsIn...
  ```
- **Request Body**: None

#### Response
- **Status**: `200 OK`
- **Response Body**:
  ```json
  {
    "data": [
      {
        "id": "note_8f9c1a7b",
        "userId": "usr_42019a",
        "title": "System Architecture Review",
        "body": "Discussed database sharding, Redis cache replication, and horizontal scaling strategies for 1M DAU.",
        "category": "work",
        "tags": ["architecture", "scaling", "backend"],
        "pinned": true,
        "createdAt": "2026-10-18T10:30:00Z",
        "updatedAt": "2026-10-18T10:30:00Z"
      },
      {
        "id": "note_123e4567",
        "userId": "usr_42019a",
        "title": "Cloud Infrastructure Migration",
        "body": "VPC peering and CDN edge delivery setup.",
        "category": "work",
        "tags": ["architecture", "devops"],
        "pinned": false,
        "createdAt": "2026-10-17T14:15:22Z",
        "updatedAt": "2026-10-17T16:00:10Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
  ```

---

## 4. Standard Error Handling & Status Codes

All non-2xx responses return a consistent JSON error schema:

```json
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable explanation of what went wrong.",
    "status": 400,
    "timestamp": "2026-10-18T10:35:00Z",
    "details": []
  }
}
```

### Supported Error Codes

#### 1. `400 Bad Request`
- **When it happens**: Client sends invalid input, malformed JSON, missing mandatory fields (e.g., omitting `title`), or exceeding constraints (e.g., `title` longer than 100 characters).
- **Example Response Body**:
  ```json
  {
    "error": {
      "code": "VALIDATION_FAILED",
      "message": "Note validation failed.",
      "status": 400,
      "timestamp": "2026-10-18T10:35:12Z",
      "details": [
        {
          "field": "title",
          "message": "Title is required and must not exceed 100 characters."
        }
      ]
    }
  }
  ```

#### 2. `401 Unauthorized`
- **When it happens**: The request lacks an `Authorization` header, the Bearer token has expired, or the signature verification fails.
- **Example Response Body**:
  ```json
  {
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Missing or expired JWT access token.",
      "status": 401,
      "timestamp": "2026-10-18T10:35:20Z"
    }
  }
  ```

#### 3. `403 Forbidden`
- **When it happens**: The user is authenticated, but does not have permission to access or modify the requested resource (e.g., User A attempts to edit a note owned by User B).
- **Example Response Body**:
  ```json
  {
    "error": {
      "code": "FORBIDDEN",
      "message": "You do not have permission to modify this note.",
      "status": 403,
      "timestamp": "2026-10-18T10:35:30Z"
    }
  }
  ```

#### 4. `404 Not Found`
- **When it happens**: The requested note ID or endpoint does not exist.
- **Example Response Body**:
  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "Note with ID 'note_9999999' was not found.",
      "status": 404,
      "timestamp": "2026-10-18T10:35:40Z"
    }
  }
  ```

#### 5. `500 Internal Server Error`
- **When it happens**: An unhandled server error occurs (e.g., database network partition, unhandled exception in downstream service).
- **Example Response Body**:
  ```json
  {
    "error": {
      "code": "INTERNAL_SERVER_ERROR",
      "message": "An unexpected error occurred. Our engineering team has been notified.",
      "status": 500,
      "timestamp": "2026-10-18T10:35:50Z"
    }
  }
  ```
