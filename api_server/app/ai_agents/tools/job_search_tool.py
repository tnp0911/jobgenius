from fastmcp import FastMCP
from typing import Optional, List
from app.services.job_service import search_jobs_with_jsearch

mcp = FastMCP("job_search_tool")



@mcp.tool("search_jobs", 
    description="""
    Search jobs through the third-party API (JSearch API)
    Parameters:
        query: The query to search for jobs
        country: 2-letter country code for the job search. Default: ca. Override from resume / user location when available (e.g. us, gb, au, in) — do not always leave it as ca
        language: The language to search for jobs (if given) - Default values: en
        date_posted: Date posted (if given) - Default values: all, today, 3days, week, month
        employment_types (optional): Employment types (if given) - Default values: FULLTIME, CONTRACTOR, PARTTIME, INTERN
        job_requirements (optional): No default value - List of strings separated by commas: under_3_years_experience, more_than_3_years_experience, no_experience, no_degree
    Returns:
        A list of jobs in JSON format
    """)
async def search_jobs(
    query: str, 
    country: str = "ca", 
    language: str = "en", 
    date_posted: str = "all", 
    employment_types: Optional[List[str]] = None, 
    job_requirements: Optional[List[str]] = None
):
    return await search_jobs_with_jsearch(query, country, language, date_posted, employment_types, job_requirements)