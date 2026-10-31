from app.ai_agents.tools.job_search_tool import mcp as job_search_tool_mcp

if __name__ == "__main__":
    job_search_tool_mcp.run(transport="stdio")