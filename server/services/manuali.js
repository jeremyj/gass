/**
 * User manuals as public web pages: docs/MANUALE_*.md rendered to HTML once, on first request.
 * The Markdown files stay the only source; links between them point to the page URLs.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const DOCS = path.join(__dirname, '../../docs');
const MANUALI = {
  partecipanti: { file: 'MANUALE_PARTECIPANTI.md', url: '/manuale' },
  amministratori: { file: 'MANUALE_AMMINISTRATORI.md', url: '/manuale-admin' }
};

const STYLE = `
  :root { --bg: #FAF9F7; --ink: #333333; --muted: #6B6B6B; --accent: #2F6B5A; --line: #DDD9D1; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Helvetica, Arial, sans-serif;
         font-size: 18px; line-height: 1.6; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 48px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 16px; }
  h2 { font-size: 24px; margin: 40px 0 12px; padding-top: 16px; border-top: 1px solid var(--line); }
  h3 { font-size: 20px; margin: 28px 0 8px; }
  p, ul, ol { margin: 0 0 16px; }
  li { margin: 4px 0; }
  a { color: var(--accent); font-weight: 600; }
  code { font-size: 16px; background: #EFECE6; padding: 1px 5px; border-radius: 4px; }
  /* Wide tables scroll sideways on a phone instead of widening the page */
  table { display: block; overflow-x: auto; border-collapse: collapse; margin: 0 0 20px; font-size: 16px; }
  th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #EFECE6; }`;

const cache = {};

function renderManuale(nome) {
  if (cache[nome]) return cache[nome];
  const { file } = MANUALI[nome];
  let md = fs.readFileSync(path.join(DOCS, file), 'utf8');
  for (const m of Object.values(MANUALI)) md = md.split(`](${m.file})`).join(`](${m.url})`);
  const body = marked.parse(md);
  const title = /^# (.+)$/m.exec(md)?.[1] || 'GASS';
  cache[nome] = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
${body}
<p>Per entrare: <a href="/">gass.x86.it</a>.</p>
</main>
</body>
</html>`;
  return cache[nome];
}

module.exports = { MANUALI, renderManuale };
