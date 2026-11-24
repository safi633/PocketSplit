const MODEL_CACHE_MS = 5 * 60 * 1000;
const MAX_AUTO_ATTEMPTS = 5;
const AUTO_MODEL_PREFERENCE = [
  'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash',
  'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest',
  'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
];
const EXCLUDED_CHAT_MODEL_TYPES = /(image|audio|tts|transcribe|robotics|live|embedding)/i;

let modelCache = { expiresAt: 0, models: [] };

function modelName(model) {
  return String(model.name || '').replace(/^models\//, '');
}

async function getAvailableModels(apiKey, { forceRefresh = false } = {}) {
  if (!forceRefresh && modelCache.expiresAt > Date.now()) return modelCache.models;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error?.message || 'Could not load Gemini models.');
    error.status = response.status;
    throw error;
  }

  const models = (result.models || [])
    .filter((model) => modelName(model).startsWith('gemini-')
      && /flash/i.test(modelName(model))
      && !EXCLUDED_CHAT_MODEL_TYPES.test(modelName(model))
      && model.supportedGenerationMethods?.includes('generateContent')
    )
    .map((model) => ({
      id: modelName(model),
      label: model.displayName || modelName(model),
      inputTokenLimit: model.inputTokenLimit || null,
      outputTokenLimit: model.outputTokenLimit || null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  modelCache = { expiresAt: Date.now() + MODEL_CACHE_MS, models };
  return models;
}

function automaticModelOrder(models, configuredPreferred = process.env.GEMINI_MODEL) {
  const ids = new Set(models.map((model) => model.id));
  const ordered = [...new Set([configuredPreferred, ...AUTO_MODEL_PREFERENCE])]
    .filter((id) => typeof id === 'string' && ids.has(id));
  return [...ordered, ...models.map((model) => model.id).filter((id) => !ordered.includes(id))];
}

function statusCode(error) {
  const candidates = [error?.status, error?.response?.status, error?.code, error?.error?.code, error?.response?.data?.error?.code, error?.cause?.status];
  for (const candidate of candidates) {
    const status = Number(candidate);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  const message = String(error?.message || '');
  const match = message.match(/"code"\s*:\s*(\d{3})/);
  if (match) return Number(match[1]);
  const statusMatch = message.match(/\b(400|401|402|403|404|408|429|5\d{2})\b/);
  return statusMatch ? Number(statusMatch[1]) : 0;
}

function isTransientModelError(error) {
  const status = statusCode(error);
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const unavailableModel = status === 404
    || (status === 400 && /model.*(not found|not supported|deprecated|unavailable)|(?:not found|not supported|deprecated|unavailable).*model/.test(message))
    || (status === 403 && /model.*(not available|not enabled|access)|(?:not available|not enabled|access).*model/.test(message));
  return unavailableModel || status === 403 || status === 408 || status === 429 || status >= 500
    || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)
    || ['TimeoutError', 'AbortError'].includes(error?.name);
}

async function generateWithModelFallback({ modelPreference = 'auto', generate }) {
  const cachedModels = modelCache.expiresAt > Date.now() ? modelCache.models : [];
  const cachedOrder = automaticModelOrder(cachedModels, process.env.GEMINI_MODEL);
  const preferred = modelPreference === 'auto'
    ? (process.env.GEMINI_MODEL || AUTO_MODEL_PREFERENCE[0])
    : modelPreference;
  const chosen = [...new Set([preferred, ...cachedOrder, ...AUTO_MODEL_PREFERENCE])].slice(0, MAX_AUTO_ATTEMPTS);
  let lastError;
  const attemptedModels = [];
  for (const model of chosen) {
    try {
      const result = await generate(model);
      return { ...result, model };
    } catch (error) {
      lastError = error;
      attemptedModels.push({ model, status: statusCode(error) || null });
      if (!isTransientModelError(error)) throw error;
    }
  }
  if (lastError) lastError.attemptedModels = attemptedModels;
  throw lastError || new Error('No Gemini model could complete the request.');
}

module.exports = { automaticModelOrder, generateWithModelFallback, getAvailableModels, statusCode };
