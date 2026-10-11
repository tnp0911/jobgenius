from pathlib import Path

import pymupdf
from app.ai_agents.premium_multiagents import jobfinder_agent
from app.db.mcp import init_mcp_client
from app.helpers.llm_call import agent7_jobfinder_format_result


async def test_agent_jobfinder():
    print("Testing agent jobfinder")
    await init_mcp_client()
    print("MCP client initialized")
    pdf_bytes = Path(
        r"D:\IT\My Projects\jobgenius\api_server\external\Tuong_Nguyen_Pham_Resume.pdf"
    ).read_bytes()
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()  # type: ignore
    doc.close()
    user_requirements = (
        "I am looking for a job as a software engineer with a focus on web development."
    )
    messages, raw_jobs = await jobfinder_agent(
        resume_text=text, user_requirements=user_requirements
    )
    jobfinder_result = agent7_jobfinder_format_result(messages, raw_jobs)
    explanation_message = jobfinder_result["message"]
    jobs = jobfinder_result.get("jobs") or []
    print(explanation_message)
    print(jobs)


if __name__ == "__main__":
    import asyncio

    asyncio.run(test_agent_jobfinder())
