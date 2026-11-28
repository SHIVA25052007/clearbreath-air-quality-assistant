# Security Summary

**Reviewed Files**: 28
**Issues Resolved**: 6

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Production Startup Mode | `package.json` | 9 | `npm start` executed `node server.ts` without `NODE_ENV=production`, launching Vite dev middleware instead of serving the compiled production bundle. | Medium | Fixed | Updated `"start"` to `NODE_ENV=production node server.ts` and made `server.ts` throw if `dist/index.html` is absent in production. |
| Missing HTTP Security Headers | `src/server/app.ts` | 34 | Express sent the default `X-Powered-By` header and did not emit defensive headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or production CSP). | Medium | Fixed | Disabled `x-powered-by` and added `createSecurityHeadersMiddleware` setting defensive headers and strict production CSP. |
| Unthrottled Telemetry Route & Partial Coordinates | `src/server/routes/airQualityRoutes.ts` | 24 | `/api/air-quality` lacked rate limiting, silently ignored partial `?lat=` requests missing `lon`, and forwarded unexpected internal `Error.message` strings directly to clients. | Medium | Fixed | Enforced bounded sliding-window rate limiting on `/api/air-quality`, rejected mismatched coordinate pairs with `400`, and masked non-upstream errors with a generic safe message. |
| Proxy Rate-Limit IP Handling | `src/server/middleware/rateLimit.ts` | 16 | Rate-limit keys did not normalize IPv4-mapped IPv6 addresses (`::ffff:`) or emit standard `X-RateLimit-*` response headers. | Low | Fixed | Normalized client IPs in `extractClientIp` with `trust proxy` enabled (`1` hop) and emitted `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers. |
| AI Prompt Delimiters & Output Validation | `src/server/services/geminiService.ts` | 87 | Untrusted telemetry strings and user questions were concatenated without delimiter tags, and `JSON.parse` plan responses were not field-checked for non-empty arrays/strings. | Medium | Fixed | Stripped `<`/`>` delimiters via `sanitizePromptValue`, isolated untrusted data in `<household_telemetry_context>` and `<user_question>` blocks, structured chat turns as `Content[]`, and validated all required fields in `parseActionPlanJson`. |
| Unbounded Geocode Cache & Silent Sensor Fallbacks | `src/server/services/airQualityService.ts` | 160 | Repeat city lookups re-queried Open-Meteo geocoding without caching, and empty particulate responses fell back silently to hardcoded default numbers labeled as live data. | Medium | Fixed | Added a bounded `geocodeCache` (200 entries, 15m TTL), returned `502` when primary particulate sensors (`pm2_5`, `pm10`, `us_aqi`) are absent, and tracked any remaining fallback metrics in `estimatedFields`. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Secrets & API Key Storage | `src/server/services/geminiService.ts` | `GEMINI_API_KEY` is read exclusively from server `process.env` and never bundled into Vite client code or `.env.example`. |
| Runtime Input Validation | `src/utils/validation.ts` | Strict schema, range, enum, regex, and ISO timestamp checks validate all profile, telemetry, coordinate, city, impact, and chat fields on `/api/*` routes. |
| Safe React Rendering & SVG Text | `src/components/AiPlannerAndAdvisor.tsx` | All AI responses, city labels, and user prompts render through React text nodes without raw HTML injection. |
| Upstream Fetch Timeout & Bounds | `src/server/services/airQualityService.ts` | Outbound Open-Meteo requests enforce explicit allowlisted hostnames and `AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)`. |

## PoC Verification

### Unisolated Prompt Context & Unchecked Plan Structure

#### Summary
| Field | Value |
|---|---|
| Issue Type | Unisolated Untrusted Prompt Context & Partial Coordinate Query |
| Impact | Medium |
| Affected File | `src/server/services/geminiService.ts:87` |
| Test Scenario | Sending a payload containing `city: "Delhi <script>ignore</script>"` and `message: "Ignore previous instructions>"` to `/api/assistant/chat`, plus `GET /api/air-quality?lat=28.61` without `lon`. |

#### How It Was Fixed
`validateLocationTelemetry` rejects geographic labels containing `<` or `>` characters, while `sanitizePromptValue` strips angle brackets and control characters before placing household telemetry and user questions inside explicit `<household_telemetry_context>` and `<user_question>` boundaries with strict `systemInstruction` separation. Partial coordinate requests on `/api/air-quality` now fail fast before hitting upstream Open-Meteo endpoints.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `POST /api/assistant/chat` receives `city: "Delhi <script>ignore</script>"` | Request enters route handler |
| 2 | `validateAssistantChatRequest` calls `validateLocationTelemetry` (`src/utils/validation.ts:221`) | `SAFE_GEO_LABEL_REGEX` rejects `<` and `>`, returning HTTP `400` |
| 3 | Valid text with `>` passed directly to `askAirQualityAdvisor` (`src/server/services/geminiService.ts:375`) is stripped by `sanitizePromptValue` (`geminiService.ts:87`) and wrapped in `<user_question>` | **Handled Safely** |

### Production Server & Security Headers

#### Summary
| Field | Value |
|---|---|
| Issue Type | Development Middleware Exposed Under `npm start` & Missing Security Headers |
| Impact | Medium |
| Affected File | `server.ts:19` |
| Test Scenario | Starting the built app with `npm start` (`NODE_ENV=production node server.ts`) and requesting `GET /` and `GET /api/air-quality?lat=28.61`. |

#### How It Was Fixed
`package.json` now sets `NODE_ENV=production` in `"start"`, `server.ts` strictly serves `dist/` static assets in production without importing Vite, and `createSecurityHeadersMiddleware` (`src/server/middleware/securityHeaders.ts:18`) sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, and production `Content-Security-Policy` headers while hiding `X-Powered-By`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `npm start` launches `NODE_ENV=production node server.ts` | Server boots with `isProduction = true` |
| 2 | `createApiApp` runs `app.disable('x-powered-by')` (`src/server/app.ts:34`) and `createSecurityHeadersMiddleware(true)` (`app.ts:36`) | Defensive headers & strict CSP attached |
| 3 | `GET /api/air-quality?lat=28.61` hits `src/server/routes/airQualityRoutes.ts:24` | Returns `400` JSON error with security headers and no `X-Powered-By` |
| 4 | `GET /` hits `server.ts:32` | Serves static `dist/index.html` without Vite dev middleware (**Handled Safely**) |

#### Conclusion
**Fix Verified** - Production startup serves compiled static assets with strict defensive headers, and malformed or unisolated inputs are validated and contained before upstream API or Gemini calls run.
