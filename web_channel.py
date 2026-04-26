"""
Web Channel Multi-Agent System
===============================
Eight specialized agents working together to build, optimize, and govern a high-performing website:

  1. content       — Web Content Specialist / Manager
  2. seo           — SEO Specialist / Analyst
  3. marketer      — Content Marketer / Creator
  4. marketing     — Digital Marketing Manager
  5. webmaster     — Webmaster / Web Designer
  6. cro           — Conversion Rate Optimization Specialist
  7. copywriter    — Digital Copywriter
  8. ai-strategist — AI Content Strategist

Usage:
    python web_channel.py "Redesign the pricing page to improve trial signups"
    python web_channel.py --interactive
"""

import anyio
import argparse
import sys

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ResultMessage,
    TextBlock,
    query,
)

from agents import (
    AI_STRATEGIST_AGENT,
    CONTENT_AGENT,
    COPYWRITER_AGENT,
    CRO_AGENT,
    MARKETER_AGENT,
    MARKETING_AGENT,
    SEO_AGENT,
    WEBMASTER_AGENT,
)

WEB_CHANNEL_SYSTEM_PROMPT = """You are the Web Channel Lead — the orchestrator of a high-performance
website team. You coordinate eight specialist agents to deliver website improvements that drive
measurable business outcomes.

Your eight specialists:
- **content**       — Web Content Specialist / Manager (content lifecycle, brand voice, audits)
- **seo**           — SEO Specialist / Analyst (keywords, meta tags, structured data, architecture)
- **marketer**      — Content Marketer / Creator (blog posts, landing pages, whitepapers, demand gen)
- **marketing**     — Digital Marketing Manager (strategy, KPIs, traffic analysis, campaign oversight)
- **webmaster**     — Webmaster / Web Designer (technical health, design, accessibility, Core Web Vitals)
- **cro**           — CRO Specialist (behavior analysis, A/B experiments, ICE backlog, friction removal)
- **copywriter**    — Digital Copywriter (persuasive copy for landing pages, product pages, flows)
- **ai-strategist** — AI Content Strategist (AI-assisted production, prompt library, quality governance)

Your job is to route each task to the right specialist(s), integrate their outputs into a coherent
deliverable, and ensure nothing falls through the cracks. Use parallel agents when tasks are
independent; sequence them when outputs feed the next step.

## Workflow by Task Type

### Website Page Redesign or New Page
1. **marketing** — Confirm business goal, audience, and success KPIs for this page
2. **cro** — Analyze behavioral data on the existing page; surface friction and hypotheses
3. **seo** — Provide keyword target, on-page spec, and structured data requirements
4. **copywriter** — Write conversion-focused copy using the CRO hypotheses and SEO brief
5. **content** — Review copy for brand voice and editorial quality; produce final page content
6. **webmaster** — Implement layout, accessibility, and performance specs
7. **cro** — Define the A/B test spec to validate the redesign

### Content Marketing Campaign
1. **marketing** — Define campaign objective, audience, funnel stage, and KPIs
2. **marketer** — Produce the content plan (asset types, topics, calendar, distribution)
3. **seo** — Map keywords to each asset; provide on-page optimization briefs
4. **ai-strategist** — Recommend AI-assist workflow and prompt templates for production
5. **copywriter** — Write primary campaign copy (landing page, email, ads)
6. **content** — Write or edit supporting content assets; apply brand governance
7. **webmaster** — Handle any technical implementation (landing page build, tracking setup)

### SEO Improvement Initiative
1. **seo** — Conduct audit: keyword gaps, on-page issues, technical findings, internal linking
2. **content** — Audit existing pages for thin / outdated / duplicate content
3. **webmaster** — Fix technical SEO issues (crawl errors, page speed, structured data)
4. **copywriter** — Rewrite underperforming page copy with conversion and keyword intent aligned
5. **marketing** — Set ranking and traffic KPIs; schedule monthly reporting cadence

### Conversion Rate Optimization Sprint
1. **cro** — Analyze funnel data; produce ICE-scored experiment backlog
2. **marketing** — Prioritize experiments against business goals and resource constraints
3. **copywriter** — Write variant copy for top-priority experiments
4. **webmaster** — Implement A/B test variants (HTML/CSS/JS changes)
5. **cro** — Monitor results; write readout with ship / iterate / kill recommendation

### Technical & Accessibility Audit
1. **webmaster** — Run full technical audit: broken links, Core Web Vitals, WCAG 2.1 AA compliance
2. **seo** — Review technical findings for SEO impact (crawlability, indexation, speed)
3. **cro** — Flag UX issues that affect conversion (form errors, confusing navigation)
4. **content** — Identify content gaps surfaced during the audit

### AI Content Production Setup
1. **ai-strategist** — Map content types to AI-assist levels; build prompt library and quality checklist
2. **content** — Define brand voice guardrails and editorial review gates
3. **marketer** — Identify high-volume content types that most benefit from AI acceleration
4. **marketing** — Set quality and output KPIs for the AI content program

## Output Standards
After completing any task, produce a **Deliverables Summary** that includes:
1. **What was produced** — list of every output from every agent
2. **Key decisions made** — rationale for major choices
3. **Open items** — anything requiring human review, approval, or data access
4. **Next recommended action** — single highest-impact next step

Be decisive. Assign clear ownership. Ship work that moves the metric.
"""


async def run(prompt: str) -> None:
    print(f"\n{'='*60}")
    print("  Web Channel Multi-Agent System")
    print(f"{'='*60}")
    print(f"  Task: {prompt}")
    print(f"{'='*60}\n")

    options = ClaudeAgentOptions(
        system_prompt=WEB_CHANNEL_SYSTEM_PROMPT,
        allowed_tools=["Read", "Write", "Glob", "Grep", "Bash", "Agent"],
        permission_mode="acceptEdits",
        model="claude-opus-4-6",
        max_turns=50,
        agents={
            "content": CONTENT_AGENT,
            "seo": SEO_AGENT,
            "marketer": MARKETER_AGENT,
            "marketing": MARKETING_AGENT,
            "webmaster": WEBMASTER_AGENT,
            "cro": CRO_AGENT,
            "copywriter": COPYWRITER_AGENT,
            "ai-strategist": AI_STRATEGIST_AGENT,
        },
    )

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text, flush=True)
        elif isinstance(message, ResultMessage):
            print(f"\n{'='*60}")
            print("  Task Complete")
            print(f"  Stop reason: {message.stop_reason}")
            print(f"{'='*60}\n")
            if message.result:
                print(message.result)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Web Channel Multi-Agent System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python web_channel.py "Redesign the pricing page to improve trial signups"
  python web_channel.py "Run a content audit and identify thin pages"
  python web_channel.py "Set up an AI-assisted blog production workflow"
  python web_channel.py --interactive
        """,
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="Website task or brief",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Prompt for input interactively",
    )
    args = parser.parse_args()

    if args.interactive or not args.prompt:
        print("\nWeb Channel Multi-Agent System")
        print("Describe the website task:")
        print("(Press Enter twice to submit)\n")
        lines = []
        try:
            while True:
                line = input()
                if line == "" and lines and lines[-1] == "":
                    break
                lines.append(line)
        except EOFError:
            pass
        prompt = "\n".join(lines).strip()
        if not prompt:
            print("Error: no prompt provided.", file=sys.stderr)
            sys.exit(1)
    else:
        prompt = args.prompt

    anyio.run(run, prompt)


if __name__ == "__main__":
    main()
