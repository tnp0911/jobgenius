import json
import logging

from langchain.agents import create_agent
from langchain_core.messages import ToolMessage
from langchain_ollama import ChatOllama

from app.core.config import settings
from app.db.mcp import get_mcp_client_tools
from app.helpers.job_indexing import index_jobs_in_background

logger = logging.getLogger(__name__)


async def jobfinder_agent(
    resume_text: str,
    analyzed_results_dict: dict | None = None,
    user_requirements: str = "",
):
    mcp_client_tools = await get_mcp_client_tools()

    model = ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_HOST,
    )

    agent = create_agent(model=model, tools=mcp_client_tools)

    messages = [
        {
            "role": "system",
            "content": """
                You are a job finder agent. You are provided with an original resume text 
                An analyzed results dictionary from previous agents or user requirements are optional.
                Your task is to find the best jobs for the user based on the original resume text and the analyzed results dictionary or user requirements.
                You are also provided with a tool to search for jobs.
                Note that you need to self-analyze the input to determine the best query to search for jobs for the user.
                Allowed actions:
                - Call the search_jobs tool
                - Briefly explain why returned jobs fit

                When calling search_jobs:
                - query MUST look like: "{role} in {city}, {country}"
                - Infer city/country from resume or user_requirements (e.g. Windsor, Toronto, Canada)
                - Always pass country as a 2-letter code (e.g. ca)
                - Prefer 1-2 focused searches over vague role-only queries
                - Avoid country-only queries like "software engineer Canada"

                Forbidden actions:
                - Do NOT rewrite the resume
                - Do NOT optimize, improve, or reformat the resume
                - Do NOT invent jobs without calling search_jobs
                You must return the jobs with a beautiful and concise description of the job for next steps.
            """,
        }
    ]

    if analyzed_results_dict:
        messages.append(
            {
                "role": "user",
                "content": f"""
                    Original resume text: {resume_text}
                    Analyzed results dictionary: {json.dumps(analyzed_results_dict, indent=2)}
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