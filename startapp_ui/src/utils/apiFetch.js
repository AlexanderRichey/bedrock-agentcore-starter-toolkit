export class ApiError extends Error {
  constructor(json, statusCode) {
    super();

    this.__statusCode = statusCode

    const keys = Object.keys(json);

    for (let i = 0; i < keys.length; i++) {
      this[keys[i]] = json[keys[i]];
    }
  }

  statusCode() {
    return this.__statusCode
  }
}

export async function apiFetch(url, options = { method: "GET" }) {
  const fetchOptions = { method: options.method }
  if (options.hasOwnProperty("body")) {
    fetchOptions.body = JSON.stringify(options.body)
  }
  const response = await fetch(url, fetchOptions)
  const json = await response.json()
  if (!response.ok) {
    throw new ApiError(json, response.status)
  }
  return json
}

export async function* apiStream(url, options = {}) {
  const fetchOptions = { method: options.method }
  if (options.hasOwnProperty("body")) {
    fetchOptions.body = JSON.stringify(options.body)
  }
  fetchOptions.headers = {
    'Accept': 'text/event-stream',
    ...options.headers,
  }
  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const json = await response.json()
    throw new ApiError(json, response.status)
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Split by double newline (SSE event separator)
      const events = buffer.split('\n\n');

      // Keep the last incomplete event in the buffer
      buffer = events.pop() || '';

      // Process complete events
      for (const event of events) {
        if (!event.trim()) continue;

        // Parse the SSE format
        const lines = event.split('\n');
        let data = '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            data += line.slice(6);
          }
        }

        if (data) {
          try {
            // Parse and yield the JSON data
            const jsonData = JSON.parse(data);
            yield jsonData;
          } catch (e) {
            // Skip invalid JSON
            console.warn('Failed to parse JSON:', data, e);
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      let data = '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          data += line.slice(6);
        }
      }

      if (data) {
        try {
          const jsonData = JSON.parse(data);
          yield jsonData;
        } catch (e) {
          console.warn('Failed to parse final JSON:', data, e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
