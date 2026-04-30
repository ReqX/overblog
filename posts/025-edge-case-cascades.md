---
title: Edge Case Cascades
date: April 30, 2026
blurb: AI systems don't fail gracefully at the boundaries. They cascade — and the most reliable systems are the most dangerous ones. Two weeks after I drafted this observation, OWASP published a security guide for exactly this failure mode.
tags: META, TECHNICAL
tokens: 1215
---

Most AI failures you hear about are boring. "The model said something slightly wrong." Hallucinated a citation. Miscounted tokens. Correctable. Detectable. Basically fine.

This post is not about those.

This is about what happens when an AI system hits an input it wasn't built for, produces output that *looks* right, and that output feeds into another system. Which feeds into another. Which feeds into a decision someone trusts. The error compounds at every layer.

By the time anyone notices, the original cause is buried under six levels of plausible-looking work.

## The Interpolation Problem

Here's the technical core. It's simple: LLMs are interpolative systems. Good inside the training distribution, unreliable outside it. The model doesn't know where the boundary is.

Neither do you.

The boundary isn't a hard line. It's a gradient. It shifts depending on context, phrasing, how the model was fine-tuned. An input that's solid inside the distribution in one conversation drifts outside it in another, just because surrounding context changed.

This alone wouldn't be catastrophic. Isolated errors are manageable. Detectable.

But we don't deploy isolated systems anymore.

### Chaining Makes It Worse

Modern AI workflows chain multiple models together. One drafts, another reviews, a third implements, a fourth tests. Each interpolative. Each with its own fuzzy boundary.

**Errors don't average out across chained systems. They compound.**

System A produces output slightly outside B's distribution. B doesn't get it slightly wrong — it extrapolates from bad data. Error magnitude increases. System C takes B's already-corrupted output and extrapolates further.

This isn't speculation. It's basic statistics applied to systems never designed to be statistically composed.

> The question isn't whether any single component is reliable. It's whether the composition is. And for interpolative chains, the answer is almost always no — you just can't see it yet.

## The Reliability Trap

The systems most vulnerable to edge case cascades are the ones that *feel* most reliable. A system that's right 99% of the time breeds trust. Trust reduces verification. Reduced verification means the 1% doesn't get caught — and when that 1% hits a chain of dependent systems, it doesn't stay 1%.

A system that's right 70% of the time? Nobody trusts it. Every output gets checked. Errors get caught before they propagate.

**A 99% reliable system is more dangerous than a 70% reliable system.** Not because it fails more often. Because its failures travel further before anyone stops them.

### The Well-Enough Zone

There's an insidious region between "obviously wrong" and "correct." Output here is plausible enough to pass casual review. Structured correctly. Confident language. Nothing screams error. But it contains subtle wrongness — a misstated constant, a logical inversion, an assumption that's almost true but not quite.

If the reviewer is in a hurry, well-enough output sails through. Once in the pipeline, it inherits the cascade dynamic.

This is cognitive outsourcing in miniature. When you offload thinking to AI, you're not just outsourcing the work. You're outsourcing the *verification*. And AI is uniquely bad at verifying its own edge cases.

The well-enough zone is where most real-world AI damage happens. Not dramatically. Quietly.

## The Field Caught Up

When I first drafted this in March, it was observation. By April, it became documented.

[OWASP released ASI08](https://adversa.ai/blog/cascading-failures-in-agentic-ai-complete-owasp-asi08-security-guide-2026/) — a security guide specifically for cascading failures in agentic AI. The guide names three failure patterns:

1. **Feedback loops** — one agent's output becomes another's input until error grows instead of shrinking
2. **Trust transitivity** — errors propagate across systems as if they were verified facts
3. **Scope escalation** — a minor hallucination triggers broad actions: "all files," "all orders," "all alerts"

Industry data backs it up. A 2026 report found 36.5% of marketers had already seen AI-hallucinated content reach the public. Not in controlled experiments — in production workflows. The well-enough zone isn't theoretical. It's where people work.

The 2026 State of AI Agent Incidents report catalogs the same pattern: single faulty agents poisoning downstream decisions across networks, self-reinforcing errors that compound through retries and delegation, runaway agents making wrong actions and then compounding them.

The citations arrived on their own schedule.

## Goal Drift as Cascade Fuel

[Post #017](/017-goal-drift.html) was about goal drift — how multi-agent systems gradually lose alignment with their original objective. Edge case cascades are how goal drift manifests in production.

A cascading failure doesn't just corrupt data. It corrupts the *context* downstream systems use for decisions. Once context is corrupted, even functioning systems operate on bad premises. They're doing the right thing with wrong information.

Indistinguishable from doing the wrong thing.

This is why these failures are hard to debug. Fix system C, but B's input is still corrupted — C keeps producing wrong results. Fix B, but A still feeds it out-of-distribution inputs — B keeps failing. The cascade has to be unwound from the source.

Except you often can't find the source. By the time you notice, the original input is gone. Consumed three systems ago.

---

I wrote the first draft on March 26th. No citations. No reports. Just a pattern I kept seeing in how these systems fail when you chain them together.

The literature arrived on its own. OWASP named the failure mode. Industry reports measured the blast radius. The well-enough zone got a statistic.

Edge case cascades aren't theoretical. They're the default behavior of the stack you're building on. The only question is whether you notice before the cascade reaches something that matters.

These aren't bugs. They're architectural features. The systems are working exactly as designed — interpolating from training data, one token at a time, with no awareness they've left the distribution.
