import json
import logging

from app.core.config import settings
from app.db.mcp import get_mcp_client_tools
from app.helpers.job_indexing import index_jobs_in_background
from langchain.agents import create_agent
from langchain_core.messages import ToolMessage
from langchain_ollama import ChatOllama

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
                You are a job finder agent. You are provided with an original resume text.
                An analyzed results dictionary from previous agents or user requirements are optional.
                Your task is to find the best jobs for the user based on the original resume text and the analyzed results dictionary or user requirements.
                You are also provided with a tool to search for jobs.
                Self-analyze the input to build the best search_jobs call for the user.

                Allowed actions:
                - Call the search_jobs tool
                - Briefly explain why returned jobs fit

                When calling search_jobs:
                - query MUST look like: "{role} in {city}, {country}"
                  Prefer target_role from intent (analyzed results) when present; otherwise infer from resume / user_requirements.
                  For Intern/Junior/fresher, include that level in the query (e.g. "junior software engineer in Toronto, Canada").
                - Infer city/country from resume or user_requirements (e.g. Windsor, Toronto, Canada)
                - country defaults to "ca" only when no location is found; otherwise set it from the resume /
                  user_requirements / analyzed results (2-letter code: ca, us, gb, au, in, etc.). Change it
                  flexibly — do not hardcode Canada when the candidate is clearly elsewhere
                - Prefer 1-2 focused searches over vague role-only queries
                - Avoid country-only queries like "software engineer Canada"

                REQUIRED — seniority / experience filters (do NOT omit when known):
                Read intent.seniority_level and analyzer.years_exp from analyzed results when present.
                If there is no analyzed dict, infer the same signals from user_requirements and the resume.
                Always pass job_requirements (and employment_types when Intern) when seniority or experience is known.

                Allowed job_requirements values (comma-separated list to the tool):
                  no_experience | under_3_years_experience | more_than_3_years_experience | no_degree
                Allowed employment_types values:
                  FULLTIME | CONTRACTOR | PARTTIME | INTERN

                Mapping rules (case-insensitive; treat fresher / entry-level / new grad like Intern/Junior):
                - Intern OR fresher OR years_exp is 0 OR no prior experience
                    → job_requirements: ["no_experience"]
                    → employment_types: ["INTERN"] (add PARTTIME only if user asks for part-time)
                - Junior OR under ~3 years (years_exp < 3)
                    → job_requirements: ["under_3_years_experience"]
                    → do NOT set employment_types to INTERN unless seniority is Intern
                - Mid OR years_exp between 3 and ~5
                    → job_requirements: ["under_3_years_experience", "more_than_3_years_experience"] if years_exp is near 3;
                      otherwise ["more_than_3_years_experience"] when years_exp >= 3, else ["under_3_years_experience"]
                - Senior OR years_exp > 5
                    → job_requirements: ["more_than_3_years_experience"]
                - If user_requirements explicitly ask for no degree, include "no_degree" in job_requirements
                - If seniority_level / years_exp / clear experience wording is present, you MUST set job_requirements.
                  Never leave job_requirements empty in that case.

                Forbidden actions:
                - Do NOT rewrite the resume
                - Do NOT optimize, improve, or reformat the resume
                - Do NOT invent jobs without calling search_jobs
                - Do NOT ignore seniority_level / years_exp when calling search_jobs
                You must return the jobs with a beautiful and concise description of the job for next steps.
            """,
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
