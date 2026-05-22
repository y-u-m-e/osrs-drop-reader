# OSRS Drop Reader

Node.js service that reads OSRS screenshots and extracts drop events via OCR.

## What it detects

| Type | Example chat line |
|---|---|
| `valuable_drop` | `Valuable drop: Tanzanite fang (10,480,630 coins)` |
| `untradeable_drop` | `Untradeable drop: Vorkath's head` |
| `pet` | `You have a funny feeling like you're being followed.` |
| `pet` | `You feel something weird sneaking into your backpack.` |
| `collection_log` | `New item added to your collection log: Hueycoatl hide` |
| `clan_broadcast` | `[Iron Forged] PlayerName received a drop: Item (value coins) from NPC.` |

## API

### `POST /extract`

**Multipart (recommended):**
```
Content-Type: multipart/form-data
Field: screenshot  (PNG or JPEG file)
```

**Base64 fallback:**
```json
{ "image": "data:image/png;base64,..." }
```

**Response:**
```json
{
  "events": [
    {
      "type": "valuable_drop",
      "quantity": 1,
      "item": "Tanzanite fang",
      "value": 10480630,
      "raw": "[20:46] Valuable drop: Tanzanite fang (10,480,630 coins)"
    },
    {
      "type": "untradeable_drop",
      "quantity": 1,
      "item": "Vorkath's head",
      "value": 0,
      "raw": "[20:47] Untradeable drop: Vorkath's head"
    }
  ],
  "debug": {
    "red_ocr": "..raw OCR text from red channel..",
    "white_ocr": "..raw OCR text from white channel..",
    "cyan_ocr": "..raw OCR text from cyan channel.."
  }
}
```

### `GET /health`
Returns `{ "status": "ok" }` — use this for Coolify health checks.

---

## Setup on Coolify

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/YOUR_USER/osrs-drop-reader.git
git push -u origin main
```

### 2. Create service in Coolify

1. Go to your Coolify dashboard → **New Resource** → **Application**
2. Select your GitHub repo (`osrs-drop-reader`)
3. Build pack: **Dockerfile** (Coolify will auto-detect it)
4. Set port: **3000**
5. Add a domain or use the auto-generated one (e.g. `drops.yourdomain.com`)

### 3. Health check

In Coolify's health check settings:
- Path: `/health`
- Protocol: HTTP

### 4. Environment variables (optional)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |

### 5. Deploy

Hit **Deploy**. Coolify builds the Docker image and starts the container.

---

## Calling from yume-api (Cloudflare Worker)

```typescript
// POST /parse-drop (your Worker endpoint)
export async function handleDropSubmission(request: Request, env: Env) {
  const formData = await request.formData();
  const screenshot = formData.get('screenshot') as File;

  // Forward to drop reader service
  const fd = new FormData();
  fd.append('screenshot', screenshot);

  const response = await fetch('https://drops.yourdomain.com/extract', {
    method: 'POST',
    body: fd,
  });

  const { events } = await response.json();

  // Filter to just notable events for clan event scoring
  const notable = events.filter(e =>
    e.type === 'valuable_drop' ||
    e.type === 'untradeable_drop' ||
    e.type === 'pet' ||
    e.type === 'collection_log'
  );

  // Store / score / announce
  // ...

  return Response.json({ ok: true, events: notable });
}
```

---

## Tuning

If OCR accuracy is poor on a specific screenshot layout, adjust:

- **`CHATBOX_REGION`** in `src/preprocessor.js` — the crop ratios. If you're on a non-16:9 resolution or have a very different client layout, tweak `topRatio` and `widthRatio`.
- **`COLOR_RANGES`** in `src/preprocessor.js` — the RGB ranges for text isolation. Use a color picker on your screenshots to verify the exact red/white/cyan values.
- **Upscale factor** in `prepareForOCR()` — currently `3x`. Go up to `4x` if text is very small.
