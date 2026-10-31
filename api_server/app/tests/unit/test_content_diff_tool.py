from app.ai_agents.tools.content_diff_tool import diff_resume_content

MESSY_RESUME = """
SUMMARY
I am a computer science and AI student who has worked on different projects and has some experience with programming. I
have used several tools and technologies and like solving problems.

PROJECTS
AI Hackathon — Virtual Clinic Simulation | Team Lead | Nov 2024

Was the team lead of a team of 4 people and worked on making a virtual clinic simulation that used OpenAI Whisper for
ASR, TTS, and LLMs to make doctor and patient interactions with different virtual patient profiles.

\tUsed RAG for allergy data and patient records and to give recommendations about medications and dietary restrictions in
real time.

EDUCATION
Centennial College — Toronto, ON
Advanced Diploma, Software Engineering Technology – AI | Jan 2023 – Apr 2025
GPA: 4.31/4.50

VOLUNTEERING
Centennial College Orientation — Toronto, ON | Volunteer | Apr 2023 – Jan 2025

Helped students by giving them directions on campus and telling them how to get to different event locations.
"""

OPTIMIZER = {
    "section_order": ["summary", "skills", "experience", "projects", "education", "other"],
    "optimized_sections": {
        "summary": (
            "Computer Science and AI student with hands-on experience in software "
            "development and AI projects."
        ),
        "skills": [],
        "experience": [],
        "projects": [
            {
                "project_title": "AI Hackathon — Virtual Clinic Simulation",
                "role": "Team Lead",
                "start_date": "Nov 2024",
                "end_date": "",
                "location": "Virtual",
                "project_description": {
                    "1": (
                        "Led a team of 4 in developing a virtual clinic simulation using "
                        "OpenAI Whisper for ASR, TTS, and LLMs."
                    ),
                    "2": (
                        "Implemented RAG for allergy data and patient records to provide "
                        "real-time medication and dietary recommendations."
                    ),
                },
                "additional_info": "",
            }
        ],
        "education": [
            {
                "degree": "Advanced Diploma, Software Engineering Technology – AI",
                "school": "Centennial College",
                "start_date": "Jan 2023",
                "end_date": "Apr 2025",
                "location": "Toronto, ON",
                "description": {"1": "GPA: 4.31/4.50"},
                "additional_info": [],
            }
        ],
        "other": [
            {
                "category": "Volunteering",
                "items": [
                    {
                        "company": "Centennial College Orientation",
                        "title": "Volunteer",
                        "start_date": "Apr 2023",
                        "end_date": "Jan 2025",
                        "location": "Toronto, ON",
                        "description": {
                            "1": "Guided students with campus navigation and event logistics."
                        },
                    }
                ],
            }
        ],
    },
}


def test_summary_and_bullets_ignore_pdf_wrap_and_tabs():
    diff = diff_resume_content(MESSY_RESUME, OPTIMIZER)

    assert diff["summary"] is not None
    assert "\n" not in diff["summary"]["original"]
    assert "\t" not in diff["summary"]["original"]
    assert "computer science and AI student" in diff["summary"]["original"]
    assert diff["summary"]["optimized"].startswith("Computer Science and AI student")

    assert len(diff["projects"]) == 1
    bullets = diff["projects"][0]["bullets"]
    assert len(bullets) == 2
    first = bullets[0]
    assert first["key"] == "1"
    assert "\n" not in first["original"]
    assert "\t" not in first["original"]
    assert "team of 4 people" in first["original"]
    assert first["original"].startswith("Was the team lead")
    assert "Led a team of 4" in first["optimized"]
    second = bullets[1]
    assert "Used RAG for allergy data" in second["original"]
    assert "Implemented RAG" in second["optimized"]


def test_unchanged_education_description_is_omitted():
    diff = diff_resume_content(MESSY_RESUME, OPTIMIZER)
    assert diff["education"] == []


def test_volunteer_maps_to_other_and_keeps_original_wording():
    diff = diff_resume_content(MESSY_RESUME, OPTIMIZER)
    assert len(diff["other"]) == 1
    other = diff["other"][0]
    assert other["company"] == "Centennial College Orientation"
    assert other["category"] == "Volunteering"
    assert len(other["bullets"]) == 1
    assert "Helped students by giving them directions" in other["bullets"][0]["original"]
    assert "Guided students" in other["bullets"][0]["optimized"]


def test_accepts_graph_result_optimizer_wrapper():
    diff = diff_resume_content(MESSY_RESUME, {"optimizer": OPTIMIZER})
    assert diff["summary"] is not None
    assert diff["projects"]


def test_empty_inputs_return_empty_diff():
    assert diff_resume_content("", OPTIMIZER)["summary"] is None
    assert diff_resume_content("SUMMARY\nHello", {})["projects"] == []
    assert diff_resume_content("SUMMARY\nHello", None)["experience"] == []


def test_identical_rewritten_whitespace_is_not_a_diff():
    resume = """
    EXPERIENCE
    Acme Corp | Engineer | 2020 – 2023
    - Built internal APIs for billing
    """
    optimizer = {
        "optimized_sections": {
            "summary": "",
            "experience": [
                {
                    "company": "Acme Corp",
                    "title": "Engineer",
                    "description": {"1": "Built internal APIs for billing"},
                }
            ],
            "projects": [],
            "education": [],
            "other": [],
        }
    }
    diff = diff_resume_content(resume, optimizer)
    assert diff["experience"] == []
