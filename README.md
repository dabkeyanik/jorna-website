# jornaevents.com

The Jorna marketing site. One self-contained page — no build step, no dependencies.

```
public/index.html    the whole site
```

## Editing

Open `public/index.html` and edit it. The CSS and JS are inline in that same file.
Preview by double-clicking the file — it renders straight from disk, no server needed.

## Deploying

Hosted on **Cloudflare Pages**, project `jorna-website`, serving the `public/` folder.

To publish a change: Cloudflare dashboard → Workers & Pages → jorna-website →
Create deployment → drag the `public` folder in.

## Design notes

- Palette is defined once as CSS custom properties in `:root`, with a
  `prefers-color-scheme: dark` block overriding it. Change a color there, not inline.
- Fonts are system stacks (Didot/Palatino serif for headings, Avenir Next/Segoe UI
  for body) — nothing is fetched over the network, which is why the page is one file.
- The client/vendor tabs and the scroll-reveal animation are the only JS, at the
  bottom of the file.
