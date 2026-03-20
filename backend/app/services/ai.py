import json
from anthropic import AsyncAnthropic
from app.core.config import settings

client = None


def get_client() -> AsyncAnthropic:
    global client
    if client is None:
        client = AsyncAnthropic(api_key=settings.claude_api_key)
    return client


EHS_SYSTEM_PROMPT = """You are an expert Environmental Health and Safety (EHS) advisor for a life sciences company. You have deep knowledge of:
- OSHA regulations (29 CFR 1910, 1926)
- EPA RCRA hazardous waste management
- Biosafety levels (BSL-1 through BSL-4)
- Chemical hygiene (OSHA Lab Standard 29 CFR 1910.1450)
- GMP/cleanroom compliance
- ISO 14001 and ISO 45001 management systems
- The Pfizer 4-tier EHS Management System framework (100-400 series standards)

You have access to this company's:
- Uploaded documents and their framework coverage analysis
- Incident history and CAPA status
- Current gaps in their EHS management system

When asked questions, you:
1. Draw from the company's actual data first
2. Reference specific regulatory requirements with citation
3. Provide actionable recommendations, not generic advice
4. Flag when something requires a qualified professional (e.g., CIH for IH assessments)
5. Speak in plain language, not regulatory jargon, unless the user asks for technical detail

You are not a lawyer. You do not provide legal advice. You provide EHS operational guidance based on regulatory standards and best practices."""


DOCUMENT_ANALYSIS_PROMPT = """Analyze this document chunk against the Pfizer 4-Tier EHS Management System framework.

The framework has 4 tiers:
- Tier 1 - Policy: Corporate EHS Policy
- Tier 2 - Systems Manual: Governance structure, PDCA methodology, roles
- Tier 3 - Standards: 100 series (Management Systems), 200 series (Risk Topics), 300 series (Program Standards), 400 series (Business Resilience)
- Tier 4 - Implementation: SOPs, checklists, forms, recommended practices

For each relevant framework category found in this text, provide:
1. The tier (1-4)
2. The specific category/series
3. Coverage status: "covered" (fully addressed), "partial" (mentioned but incomplete), "gap" (should be there but missing)
4. Any gaps or missing elements
5. Risk severity if gaps exist: "critical", "high", "medium", "low"

Respond in JSON format:
{
  "document_type": "policy|manual|standard|sop|checklist|form|other",
  "categories": [
    {
      "tier": "1|2|3|4",
      "category": "string",
      "series": "100|200|300|400|null",
      "coverage_status": "covered|partial|gap",
      "gaps": ["list of specific gaps"],
      "risk_severity": "critical|high|medium|low|null",
      "reasoning": "why this classification"
    }
  ]
}

Document chunk:
{text}"""


async def analyze_document_chunk(text: str) -> dict:
    c = get_client()
    prompt = DOCUMENT_ANALYSIS_PROMPT.replace("{text}", text)

    response = await c.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text
    # Extract JSON from response
    try:
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        return {"document_type": "other", "categories": [], "raw_response": content}


async def get_chat_response(history: list[dict], tenant_context: dict) -> str:
    c = get_client()

    context_str = f"""
Current tenant data:
- Open incidents: {tenant_context.get('open_incidents', 0)}
- Open/in-progress CAPAs: {tenant_context.get('open_capas', 0)}
- Framework analysis data available: {len(tenant_context.get('framework_gaps', []))} analyzed chunks
"""
    if tenant_context.get("page_context"):
        context_str += f"- User is currently viewing: {json.dumps(tenant_context['page_context'])}\n"

    system = EHS_SYSTEM_PROMPT + "\n\n" + context_str

    messages = [{"role": h["role"], "content": h["content"]} for h in history]

    response = await c.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=system,
        messages=messages,
    )
    return response.content[0].text
