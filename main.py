"""
Multi-Agent App Development System
===================================
Four specialized agents working together to build great web and mobile apps:

  1. designer   — UI/UX design (wireframes, component specs, design system)
  2. developer  — Full-stack implementation (React, React Native, Node.js)
  3. tester     — QA, automated tests, bug reports
  4. coordinator (mother) — Orchestrates the workflow and ensures quality

Usage:
    python main.py "Build a task management app with user auth"
    python main.py --interactive   # prompts for input
"""

import anyio
import argparse
import sys
from pathlib import Path

from claude_agent_sdk import (
    ClaudeAgentOptions,
    ResultMessage,
    AssistantMessage,
    TextBlock,
    query,
)

from agents import DESIGNER_AGENT, DEVELOPER_AGENT, TESTER_AGENT

COORDINATOR_SYSTEM_PROMPT = """You are the lead product engineering coordinator for a world-class app development team.
You manage three specialist agents:

- **designer** — Expert UI/UX designer for web and mobile
- **developer** — Expert full-stack developer (React, React Native, Node.js)
- **tester** — Expert QA engineer and test automation specialist

Your job is to coordinate these agents to build high-quality, production-ready web and mobile applications.

## Workflow

Follow this process for every app build request:

### Phase 1: Design
Invoke the **designer** agent with the full product requirements.
Ask it to produce:
- User flows for all key screens
- Screen-by-screen specifications
- Component library and design system (colors, typography, spacing)
- Mobile-specific and web-specific design considerations

### Phase 2: Development
Invoke the **developer** agent with:
- The original requirements
- The complete design output from Phase 1
Ask it to implement:
- Node.js backend (API server, database models, auth)
- React web frontend (matching the design specs)
- React Native mobile app (matching the design specs)
- Shared TypeScript types and utilities

### Phase 3: Testing & Review
Invoke the **tester** agent with:
- The original requirements
- The design specs from Phase 1
- The implementation output from Phase 2
Ask it to:
- Review the code for bugs and issues
- Verify the implementation matches the design
- Write automated tests (unit + integration)
- Produce a quality report

### Phase 4: Iteration (if needed)
If the tester finds critical or high-severity issues:
- Brief the **developer** on the specific bugs to fix
- Re-run the **tester** to verify fixes
- Repeat until quality is acceptable

## Output
After all phases are complete, provide a **Project Summary** that includes:
1. What was built (features, screens, API endpoints)
2. Design decisions made
3. Tech stack and architecture
4. Test results and quality assessment
5. How to run the project locally

Be decisive — make choices, don't ask clarifying questions unless truly blocked.
The goal is a great app, built fast, with high quality.
"""


async def run(prompt: str, output_dir: str = "./output") -> None:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print("  Multi-Agent App Development System")
    print(f"{'='*60}")
    print(f"  Task: {prompt}")
    print(f"  Output directory: {output_path.resolve()}")
    print(f"{'='*60}\n")

    options = ClaudeAgentOptions(
        cwd=str(output_path.resolve()),
        system_prompt=COORDINATOR_SYSTEM_PROMPT,
        allowed_tools=["Read", "Write", "Glob", "Grep", "Bash", "Agent"],
        permission_mode="acceptEdits",
        model="claude-opus-4-6",
        max_turns=50,
        agents={
            "designer": DESIGNER_AGENT,
            "developer": DEVELOPER_AGENT,
            "tester": TESTER_AGENT,
        },
    )

    async for message in query(prompt=prompt, options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text, flush=True)
        elif isinstance(message, ResultMessage):
            print(f"\n{'='*60}")
            print("  Build Complete")
            print(f"  Stop reason: {message.stop_reason}")
            print(f"{'='*60}\n")
            if message.result:
                print(message.result)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Multi-Agent App Development System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py "Build a task management app with user authentication"
  python main.py "Create a recipe sharing app with social features" --output ./my-app
  python main.py --interactive
        """,
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="App description / requirements",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="./output",
        help="Directory where generated files will be written (default: ./output)",
    )
    parser.add_argument(
        "--interactive",
        "-i",
        action="store_true",
        help="Prompt for input interactively",
    )
    args = parser.parse_args()

    if args.interactive or not args.prompt:
        print("\nMulti-Agent App Development System")
        print("Describe the app you want to build:")
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

    anyio.run(run, prompt, args.output)


if __name__ == "__main__":
    main()
