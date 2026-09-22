# Monitoring & Logging — detailed reference

## Principles

**You find out about production bugs from monitoring, or from an angry user — pick one.** Error tracking, uptime checks, and alerting should exist before launch, not get added after the first bad incident.

**Error tracking is the highest-leverage first step.** Sentry (free tier for small teams; self-hosted GlitchTip if budget is tight) captures exceptions with full stack traces and, critically, should be tagged with tenant ID and user ID so a production error maps to a real, contactable account.

**APM shows you *where* it's slow, not just *that* it's slow.** Datadog or New Relic (paid SaaS, fast to set up) or OpenTelemetry + Grafana/Tempo (free, self-hosted, more setup work) both let you see p95/p99 latency per endpoint and trace a single slow request across services.

**Log aggregation — centralize before you need to grep across servers.** Better Stack Logs or Papertrail (cheap, fast to set up) or Grafana Loki (free, self-hosted). The moment you have more than one instance, "SSH in and tail the log" stops working.

**Uptime monitoring is external, on purpose.** A health check that only runs from inside your own infrastructure can't tell you the whole region is unreachable. UptimeRobot (free tier), Better Uptime, or Checkly ping from outside, from multiple regions.

**Alerting has to reach a person.** A beautiful dashboard nobody is watching at 2am is not alerting. PagerDuty, Opsgenie, or Better Stack On-call, wired to your critical thresholds (error rate spike, uptime failure, queue backlog), with an escalation path if the first alert is missed.

**Database performance monitoring catches degradation early.** Postgres's own slow-query log (free, built in) or pganalyze (paid, nicer UI) flags queries getting slower as data grows — the missing index you'll otherwise find out about from a user complaint.

**Cost anomaly alerts are monitoring too.** A runaway background job or infinite loop can turn into a shocking bill before anyone notices from the logs. A billing alert on your cloud provider catches it same-day instead of end-of-month.

## Platform quick-reference

| Need | Free/cheap option | Paid SaaS option |
|---|---|---|
| Error tracking | Self-hosted GlitchTip | Sentry |
| APM | OpenTelemetry + Grafana/Tempo | Datadog, New Relic |
| Log aggregation | Grafana Loki | Better Stack, Papertrail |
| Uptime monitoring | UptimeRobot (free tier) | Better Uptime, Checkly |
| Alerting/on-call | Better Stack On-call | PagerDuty, Opsgenie |
| Session replay | — | LogRocket, Sentry Replay |
| DB performance | Postgres slow-query log | pganalyze |

## Common anti-patterns

- No error tracking until the first production incident, reconstructed from memory and user reports
- Dashboards that exist but no alert is wired to anyone
- Uptime "monitoring" that's just the app's own internal health check, blind to a full outage
- Logs scattered across instances with no central place to search them
- A single alert threshold with no escalation if the first person doesn't respond
- Finding out about a cost spike from the monthly invoice

## Checklist

- [ ] Error tracking live, tagged with tenant/user context, before launch
- [ ] APM or at minimum per-endpoint latency tracking in place
- [ ] Logs centralized and searchable by tenant/user/request ID
- [ ] External uptime monitoring pinging the real health endpoint
- [ ] Critical alerts reach an actual person, with escalation
- [ ] Slow-query logging enabled on the database
- [ ] A cost/billing anomaly alert exists
