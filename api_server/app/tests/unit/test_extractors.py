import pytest
from app.services.resume_analyzer import (
    extract_certifications,
    extract_contact_info,
    extract_languages,
    extract_professional_links,
    extract_sections_from_text,
    has_metrics,
)

CERTIFICATIONS_TEXT_SAMPLE = """
Certifications:
- AWS Certified Cloud Practitioner
"""

LANGUAGES_TEXT_SAMPLE = """
Languages:
• English                                        Native or Bilingual Proficiency
- Spanish\t\t Full Professional Proficiency
+ French - Fluent
Vietnamese\tBasic Proficiency
* German - Advanced Proficiency
"""

PROFESSIONAL_LINKS_TEXT_SAMPLE = """
Professional Links:
- https://www.linkedin.com/in/john-doe-1234567890
- https://github.com/john-doe
- https://gitlab.com/john-doe
- https://portfolio.john-doe.com
"""


def test_extract_certifications():
    certifications = extract_certifications(CERTIFICATIONS_TEXT_SAMPLE)
    assert certifications == ["AWS Certified Cloud Practitioner"]


def test_extract_languages():
    languages = extract_languages(LANGUAGES_TEXT_SAMPLE)
    assert languages == [{"language": "English", "proficiency": "native"},
                        {"language": "Spanish", "proficiency": "full professional"},
                        {"language": "French", "proficiency": "fluent"},
                        {"language": "Vietnamese", "proficiency": "basic"},
                        {"language": "German", "proficiency": "advanced"}]


def test_extract_professional_links():
    professional_links = extract_professional_links(PROFESSIONAL_LINKS_TEXT_SAMPLE)
    assert professional_links == {"linkedin": "https://www.linkedin.com/in/john-doe-1234567890", 
                                    "github": "https://github.com/john-doe", 
                                    "gitlab": "https://gitlab.com/john-doe", 
                                    "portfolio": "https://portfolio.john-doe.com", 
                                    "other": []}


def test_has_metrics_ignores_heading_and_date_lines():
    text = """
        Experience
        Software Engineer, Google
        Jan 2020 – Dec 2023
        - Built internal tools for the platform
        - Wrote documentation for the onboarding process
        Projects
        Collision Predictor
        02/2024 – 04/2024
        - Analyzed traffic data from public records
    """
    assert has_metrics(text) == 0.0


def test_has_metrics_does_not_treat_month_names_as_scale():
    text = """
        Experience
        - Software Engineer, 15 May 2020 – 20 June 2023
        - Wrote Python services for billing
    """
    assert has_metrics(text) == 0.0


def test_has_metrics_detects_same_line_bullets():
    text = """
        Experience
        Engineer, Acme
        2020 - 2023
        - Increased conversion by 25%
        - Reduced latency by 40%
        - Mentored teammates on code review
    """
    assert has_metrics(text) == 0.7


def test_has_metrics_detects_pdf_split_and_wrapped_bullets():
    text = """
        Projects
        Toronto Collision Prediction
        Team Lead
        02/2024 – 04/2024
        •
        Built and fine-tuned classification models, selecting the best model having the accuracy of approximately
        91%.
        •
        Deployed the system using HTML/CSS for the frontend and Flask for the backend.
    """
    assert has_metrics(text) == 0.7


def test_has_metrics_detects_currency_scale_and_multiplier():
    text = """
        Experience
        - Saved $1.2M in annual infrastructure costs
        - Improved throughput 10x after rewriting the queue
        - Scaled the service to 3M monthly users
    """
    assert has_metrics(text) == 1.0


def test_has_metrics_detects_metrics_in_projects():
    text = """
    PROJECTS \nAI Hackathon \n Toronto, ON \nTeam Lead \n11/2024 \n• 
    \nLed a team of 4 to design a Virtual Clinic Simulation, 
    integrating OpenAI Whisper (ASR), TTS, and LLMs to 
    \nemulate doctor-patient interactions with diverse virtual patient profiles. 
    \n• \nImplemented Retrieval-Augmented Generation (RAG) to manage allergy 
    data and maintain patient records, \ndelivering real-time recommendations 
    on medications and dietary restrictions. \n• \nDesigned a user-friendly 
    interface using HTML/CSS, and established connectivity to the backend via 
    Flask \nand Flask-SocketIO, facilitating interactive and engaging simulations.  
    \nToronto Collision Prediction System \n Toronto, ON \nTeam Lead \n 02/2024 – 04/2024 \n• 
    \nAnalyzed real KSI (Killed or Seriously Injured) data from the Toronto Police Service, uncovering key factors 
    \ncontributing to collisions. \n• \nBuilt and fine-tuned classification models, selecting the best model having the accuracy of approximately \n91%. \n• 
    \nDeployed the system using HTML/CSS for the frontend and Flask for the backend. \nSpam Detection on YouTube Comments \n Toronto, ON \nTeam Lead \n 10/2023 – 12/2023 \n• 
    \nPreprocessed data by cleaning, tokenizing, and applying Natural Language Processing (NLP) techniques to \nextract relevant features. \n• \nDeveloped a Naïve Bayes classification model to detect spam comments on YouTube using a dataset of 
    \nlabeled comments. \n• \nEvaluated model performance using accuracy, precision, and recall metrics to ensure effective spam \ndetection. \nVOLUNTERING \nCentennial College Orientation \n Toronto, ON
    """
    assert has_metrics(text) > 0.0


def test_extract_sections_same_line_heading_and_content():
    text = """
SKILLS
Python, Java
Languages: HTML/CSS, JavaScript, Python
Education
Centennial College
"""
    sections = extract_sections_from_text(text)
    assert "skills" in sections
    assert "Python, Java" in sections["skills"]
    assert "languages" in sections
    assert "JavaScript" in sections["languages"]
    assert "education" in sections
    assert "Centennial College" in sections["education"]


def test_extract_sections_ignores_inline_experience_word():
    text = """
Projects
Built a tool used for 3 years of experience tracking
"""
    sections = extract_sections_from_text(text)
    assert "projects" in sections
    assert "experience" not in sections


def test_extract_sections_does_not_match_experiences_heading():
    text = """
Experiences
Not a real section heading
Projects
Collision Predictor
"""
    sections = extract_sections_from_text(text)
    assert "experience" not in sections
    assert "projects" in sections


def test_extract_contact_info_keeps_opening_parenthesis():
    text = "Call me at (437)-428-6446 or +1 437 428 6446"
    contact = extract_contact_info(text)
    assert "(437)-428-6446" in contact["phone_numbers"]
    assert "+1 437 428 6446" in contact["phone_numbers"]


def test_extract_contact_info_ignores_gpa_and_years():
    text = """
    EDUCATION
    Centennial College
    Jan 2023 – Apr 2025
    GPA: 4.31/4.50
    Projects 2024
    """
    contact = extract_contact_info(text)
    assert contact["phone_numbers"] == []