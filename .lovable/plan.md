This is a React SPA with `react-router-dom` and `BrowserRouter`. When deployed to Vercel, direct visits to client-side routes like `/dashboard`, `/bikes`, `/intake`, etc. return 404 because Vercel tries to serve actual files instead of letting the SPA handle routing.

## Solution

Add a `vercel.json` at the project root with rewrite rules to redirect all paths to `index.html`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This tells Vercel to serve `index.html` for every route, allowing React Router to handle the client-side navigation.

## Files Changed
- `vercel.json` — New SPA rewrite configuration