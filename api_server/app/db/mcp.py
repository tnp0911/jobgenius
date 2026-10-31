import logging
import os
from pathlib import Path

from app.core.config import settings
from langchain_mcp_adapters.client import MultiServerMCPClient

logger = logging.getLogger(__name__)

mcp_client = None
mcp_job_tools = None

_API_ROOT = Path(__file__).resolve().parents[2]


def job_mcp_cwd() -> str:
    return str(_API_ROOT)


async def init_mcp_client():
    global mcp_client
    global mcp_job_tools
    mcp_client = MultiServerMCPClient(
        {
            "job_search_tool": {
                "command": "python",
                "args": ["-m", "app.mcp.job_mcp"],
                "transport": "stdio",
                "cwd": settings.MCP_JOB_CWD,
                "env": dict(os.environ),
            },
        }
    )
    mcp_job_tools = await mcp_client.get_tools(server_name="job_search_tool")
    logger.info("MCP job tools initialized successfully")


async def get_mcp_job_tools():
    if not mcp_job_tools:
        raise ValueError("MCP job tools not initialized")
    return mcp_job_tools


async def close_mcp_client():
    global mcp_client
    global mcp_job_tools
    mcp_client = None
    mcp_job_tools = None
    logger.info("MCP job tools closed successfully")
