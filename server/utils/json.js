const DEV_VERBOSE_ERRORS =
  process.env.NODE_ENV !== 'production' || process.env.TRANSCRIPT_DEBUG === '1';

export function safeJsonStringify(value, fallback = '[]') {
  try {
    return JSON.stringify(value);
  } catch (error) {
    if (DEV_VERBOSE_ERRORS) {
      console.error({
        scope: 'json',
        event: 'stringify.failed',
        message: error?.message || 'Unknown JSON stringify failure'
      });
    }

    return fallback;
  }
}

export function safeParseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (DEV_VERBOSE_ERRORS) {
      console.error({
        scope: 'json',
        event: 'parse.array.failed',
        message: error?.message || 'Unknown JSON parse failure',
        sample: value.slice(0, 200)
      });
    }

    return fallback;
  }
}

export function safeParseJsonObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (DEV_VERBOSE_ERRORS) {
      console.error({
        scope: 'json',
        event: 'parse.object.failed',
        message: error?.message || 'Unknown JSON parse failure',
        sample: value.slice(0, 200)
      });
    }

    return fallback;
  }
}
