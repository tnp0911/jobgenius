from typing import Any, Literal, NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph

from app.ai_agents.agents.agent1_intent import intent_goal_agent
from app.ai_agents.agents.agent2_analyzer import analyzer_agent_premium
from app.ai_agents.agents.agent3_ats import ats_agent_premium
from app.ai_agents.agents.agent4_optimizer import optimizer_agent
from app.ai_agents.agents.agent6_finalizer import finalizer_agent_premium
from app.ai_agents.agents.agent7_jobfinder import jobfinder_agent
from app.helpers.llm_call import agent7_jobfinder_format_result


class GraphState(TypedDict):
    # User input states
    resume_text: str
    jd_text: str | None
    user_goal: str | None
    includes_job_finder: NotRequired[bool]

    # Agent output states
    intent: dict[str, Any] | Any
    analyzer: dict[str, Any]
    ats: dict[str, Any]
    optimizer: dict[str, Any]
    feedback: dict[str, Any] | str
    job_finder: dict[str, Any] | Any | None


async def agent1_node(state: GraphState) -> dict[str, Any]:
    intent = await intent_goal_agent(
        state["resume_text"],
        state.get("jd_text") or "",
        state.get("user_goal") or "",
    )
    return {"intent": intent}


async def agent2_node(state: GraphState) -> dict[str, Any]:
    industry = state.get("intent", {}).get("industry")
    if not isinstance(industry, str):
        industry = ""
    analyzer = analyzer_agent_premium(
        state["resume_text"],
        industry,
        state.get("jd_text") or "",
    )
    return {"analyzer": analyzer}


async def agent3_node(state: GraphState) -> dict[str, Any]:
    ats = ats_agent_premium(
        state["resume_text"],
        state["analyzer"],
        state.get("jd_text") or "",
    )
    return {"ats": ats}


async def agent4_node(state: GraphState) -> dict[str, Any]:
    optimizer = await optimizer_agent(
        state["resume_text"],
        state.get("jd_text") or "",
        state.get("user_goal") or "",
        state.get("intent") or {},
        state.get("analyzer") or {},
        state.get("ats") or {},
    )
    return {"optimizer": optimizer}


async def agent6_node(state: GraphState) -> dict[str, Any]:
    feedback = await finalizer_agent_premium(
        state["resume_text"],
        state.get("intent") or {},
        state.get("analyzer") or {},
        state.get("ats") or {},
        state.get("optimizer") or {},
        state.get("jd_text") or "",
        state.get("user_goal") or "",
    )
    return {"feedback": feedback}


async def agent7_node(state: GraphState) -> dict[str, Any]:
    messages, raw_jobs = await jobfinder_agent(
        resume_text=state["resume_text"],
        user_requirements=state.get("user_goal") or "",
    )
    jobfinder_result = agent7_jobfinder_format_result(messages, raw_jobs)
    return {"job_finder": jobfinder_result}


def includes_job_finder_edge(state: GraphState) -> Literal["agent7_jobfinder", "end"]:
    if state.get("includes_job_finder", False):
        return "agent7_jobfinder"
    else:
        return "end"


async def build_premium_graph():
    graph = StateGraph(GraphState)
    graph.add_node("agent1_intent", agent1_node)
    graph.add_node("agent2_analyzer", agent2_node)
    graph.add_node("agent3_ats", agent3_node)
    graph.add_node("agent4_optimizer", agent4_node)
    graph.add_node("agent6_finalizer", agent6_node)
    graph.add_node("agent7_jobfinder", agent7_node)
    graph.add_edge(START, "agent1_intent")
    graph.add_edge("agent1_intent", "agent2_analyzer")
    graph.add_edge("agent2_analyzer", "agent3_ats")
    graph.add_edge("agent3_ats", "agent4_optimizer")
    graph.add_edge("agent4_optimizer", "agent6_finalizer")
    graph.add_edge("agent6_finalizer", END)
    graph.add_conditional_edges(
        START,
        includes_job_finder_edge,
        {
            "agent7_jobfinder": "agent7_jobfinder",
            "end": END,
        },
    )
    graph.add_edge("agent7_jobfinder", END)
    return graph.compile()
