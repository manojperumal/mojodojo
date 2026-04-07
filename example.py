"""
Quick example — run this to see the multi-agent system in action.
Builds a simple todo app with authentication.
"""

import anyio
from main import run

anyio.run(
    run,
    "Build a simple Todo app with user authentication. "
    "Users should be able to register, log in, create/update/delete their own todos, "
    "and mark todos as complete. "
    "Build: (1) a Node.js/Express REST API with JWT auth and SQLite via Prisma, "
    "(2) a React web app, and (3) a React Native mobile app using Expo.",
    "./output/todo-app",
)
