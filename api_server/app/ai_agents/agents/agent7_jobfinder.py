import json
import logging

from app.core.config import settings
from app.db.mcp import get_mcp_job_tools
from app.helpers.job_indexing import index_jobs_in_background
from langchain.agents import create_agent
from langchain_core.messages import ToolMessage
from langchain_ollama import ChatOllama
from pathlib import Path

logger = logging.getLogger(__name__)


async def jobfinder_agent(
    resume_text: str,
    analyzed_results_dict: dict | None = None,
    user_requirements: str = "",
):
    if not resume_text or not resume_text.strip():
        raise ValueError("resume_text must not be empty")
    mcp_job_tools = await get_mcp_job_tools()
    instructions_path = (
        Path(__file__).parent.parent / "instructions" / "agent7_instructions.md"
    )
    system_prompt = instructions_path.read_text(encoding="utf-8")

    model = ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_HOST,
    )

    agent = create_agent(model=model, tools=mcp_job_tools)

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    if analyzed_results_dict:
        intent = analyzed_results_dict.get("intent") or {}
        analyzer = analyzed_results_dict.get("analyzer") or {}
        seniority_level = intent.get("seniority_level") or ""
        target_role = intent.get("target_role") or ""
        years_exp = analyzer.get("years_exp")
        messages.append(
            {
                "role": "user",
                "content": f"""
                    Original resume text: {resume_text}
                    Analyzed results dictionary: {json.dumps(analyzed_results_dict, indent=2)}

                    Search constraints from previous agents (MUST apply in search_jobs):
                    - target_role: {target_role}
                    - seniority_level: {seniority_level}
                    - years_exp: {years_exp}

                    Map seniority_level / years_exp to job_requirements (and employment_types for Intern)
                    per the system rules. Do not leave job_requirements unset when seniority_level is present.
                    Call search_jobs now.
                """,
            }
        )
    else:
        messages.append(
            {
                "role": "user",
                "content": f"""
                    Original resume text: {resume_text}
                    User requirements: {user_requirements}

                    Infer seniority / experience from the resume and user requirements.
                    If the user is an intern, fresher, junior, mid, or senior (or years of experience are clear),
                    you MUST pass matching job_requirements (and employment_types for internships) to search_jobs.
                    Call search_jobs now.
                """,
            }
        )

    result = await agent.ainvoke({"messages": messages})
    if result["messages"][-1].content is None:
        logger.warning(
            "Agent 7: Job finder agent response did not call the search_jobs tool to find jobs"
        )
        messages.append(
            {
                "role": "system",
                "content": "[SYSTEM ERROR] Job finder agent response did not call the search_jobs tool to find jobs",
            }
        )
        return messages, None

    raw_jobs = None

    for msg in result["messages"]:
        if isinstance(msg, ToolMessage):
            if isinstance(msg.content, list):
                jobs = msg.content
                raw_jobs = jobs
                await index_jobs_in_background(jobs)
            else:
                parsed = (
                    json.loads(msg.content)
                    if isinstance(msg.content, str)
                    else msg.content
                )
                jobs = parsed if isinstance(parsed, list) else [parsed]
                raw_jobs = jobs
                await index_jobs_in_background(jobs)

    messages.append({"role": "assistant", "content": result["messages"][-1].content})

    messages.append(
        {
            "role": "user",
            "content": """
            You must use the jobs returned above only if there are any.
            Explain why these jobs are the best fit for the user based on the original resume text and the analyzed results dictionary or user requirements.
            Be concise and to the point.
            Use bullet points to list the reasons if it is appropriate.
            ONLY explain why these jobs are the best fit for the user.
        """,
        }
    )

    result = await agent.ainvoke({"messages": messages})
    if result:
        logger.info("Agent 7: Job finder agent response received")

    messages.append({"role": "assistant", "content": result["messages"][-1].content})

    return messages, raw_jobs
