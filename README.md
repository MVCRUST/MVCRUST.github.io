# DeepRoot Web Client

This is a minimal front-end for the DeepRoot API located at `http://16.16.70.222`.

## Features

- **Prompt page (index.html)**
  - Send natural language questions to `/api/v1/Query` and display answer
  - Sources are rendered separately in the “References” box below the response
  - Show service health and index status
  - Button to rebuild the index

- **Library page (library.html)**
  - List documents stored on the server (`GET /api/v1/Documents`)
  - Upload new files (`POST /api/v1/Documents/upload`)
  - Delete documents (`DELETE /api/v1/Documents/{fileName}`)
  - Display service/index status and rebuild control

## Implementation Notes

- All AJAX calls are done in `script.js` using `fetch` (and `XMLHttpRequest` for upload progress).
- UI updates are performed dynamically; pages degrade gracefully if the API is unreachable.
- Bootstrap is used for basic styling.

## Running Locally

Simply open the HTML files in a browser. Ensure the API is running and CORS allows requests from the file origin or serve the files from a simple HTTP server (e.g., `python -m http.server`).

## API Endpoints

The client uses the following endpoints:

- `GET /api/v1/Health` — check service health
- `GET /api/v1/index/status` — fetch index status
- `POST /api/v1/index/rebuild` — trigger index rebuild
- `POST /api/v1/Query` — send a query with JSON `{ "question": "..." }`
- `GET /api/v1/Documents` — list documents
- `POST /api/v1/Documents/upload` — upload file (multipart/form-data)
- `DELETE /api/v1/Documents/{fileName}` — delete a document

Feel free to modify and extend as needed.