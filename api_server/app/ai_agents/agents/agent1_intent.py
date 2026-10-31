import logging
from pathlib import Path

from app.helpers.llm_call import llm_call, safe_parse

logger = logging.getLogger(__name__)


async def intent_goal_agent(
    resume_text: str, jd_text: str | None = "", user_goal: str | None = ""
):
    if not resume_text or not resume_text.strip():
        raise ValueError("resume_text must not be empty")
    jd_text = jd_text or "No job description provided."
    user_goal = user_goal or "No specific goal provided."
    instructions_path = (
        Path(__file__).parent.parent / "instructions" / "agent1_instructions.md"
    )
    template = instructions_path.read_text(encoding="utf-8")

    prompt = (
        template.replace("{resume_text}", resume_text)
        .replace("{jd_text}", jd_text)
        .replace("{user_goal}", user_goal)
    )

    response = await llm_call(prompt)
    if response:
        logger.info("Agent 1: Intent goal agent response received")
    else:
        logger.error("Agent 1: Intent goal agent response failed")
        return None

    return safe_parse(response, agent_name="intent_goal_agent")
