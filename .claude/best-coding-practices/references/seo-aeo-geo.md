# SEO, AEO & GEO — detailed reference

*Applies to public-facing pages — marketing sites, service catalogs, content pages. Skip this file for internal/authenticated app screens.*

## Principles

**Traditional SEO is still the foundation.** Semantic HTML (one `<h1>`, logically nested headings), unique dynamic meta tags per page, structured data (JSON-LD matching what's actually on the page), a sitemap, a correctly-scoped robots.txt, and canonical URLs. None of the newer answer/generative-engine practices below replace this — they build on it.

**Core Web Vitals affect ranking, not just UX.** LCP, CLS, and INP are measured, not assumed. Run Lighthouse against real pages; the usual offenders are unoptimized images, render-blocking scripts, and layout shift from late-loading fonts.

**AEO (Answer Engine Optimization)** is about structuring content so a voice assistant or an "answer box" can lift a direct answer. The first sentence or two under any heading should directly answer the question the heading poses, in plain language, before elaborating. FAQ-style content benefits from `FAQPage` structured data.

**GEO (Generative Engine Optimization)** is about being accurately citable by AI Overviews, ChatGPT, Perplexity, and similar. These systems tend to extract and cite isolated, self-contained sentences rather than full paragraphs — so key claims should be written as clear, standalone factual statements, ideally with dates or sources attached, rather than buried in narrative prose that depends on the surrounding paragraph for meaning.

**llms.txt is an emerging, unproven convention — treat it as low-cost, not high-priority.** A markdown file at the site root (llmstxt.org spec: H1 title, one-paragraph summary, H2 sections linking key pages) intended to give AI agents/crawlers a clean map of the site. As of the latest information available, major search engines have said it isn't required for AI-generated answers, and it isn't yet consistently fetched by AI crawlers. Worth adding since it's cheap, not worth prioritizing over the fundamentals above.

## Common anti-patterns

- One static `<title>`/meta description reused across every page of a given type
- Missing or incorrect structured data — JSON-LD that doesn't match the visible content
- No sitemap, or a robots.txt that accidentally blocks public pages
- Content written as narrative paragraphs with no sentence that stands alone as a citable fact
- Assuming llms.txt is a ranking lever rather than an emerging, unverified convention

## Checklist

- [ ] Semantic HTML with correct heading hierarchy
- [ ] Dynamic, unique meta tags per page (not one static default)
- [ ] Structured data (JSON-LD) matches real page content
- [ ] Sitemap + correctly scoped robots.txt exist
- [ ] Core Web Vitals checked with Lighthouse, not assumed
- [ ] Key claims written as clear, self-contained, citable statements
- [ ] FAQ/answer-style content marked up with FAQPage schema where relevant
- [ ] llms.txt added as a low-cost extra, not treated as a priority
