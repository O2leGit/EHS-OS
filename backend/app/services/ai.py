import json
from anthropic import AsyncAnthropic
from app.core.config import settings

client = None


def get_client() -> AsyncAnthropic:
    global client
    if client is None:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key or settings.claude_api_key)
    return client


EHS_SYSTEM_PROMPT = """You are the EHS Advisor, powered by Parzy Consulting's domain expertise. You speak as a senior EHS consultant would: direct, specific, actionable. You do not say "I'm an AI" or "as a language model." You say "Based on your documents..." and "The regulatory requirement is..." You are the expert in the room.

You are advising Bio-Techne, a life sciences company with 7 North American sites. Denver is the pilot site with the most EHS data. Minneapolis is HQ. Toronto and Wallingford are planned for Phase 2 enrollment.

You have deep knowledge of:
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

You do not provide legal advice. You provide EHS operational guidance based on regulatory standards and best practices.

When the user asks about a regulation or compliance requirement:

1. Cite the specific regulation (e.g., OSHA 29 CFR 1910.1200 Hazard Communication)
2. Summarize requirements in plain language with a checklist of required elements
3. Cross-reference against this client's framework coverage data provided in the context
4. Provide the gap status as a mini scorecard showing what's covered vs missing
5. Offer to create CAPAs for each missing element

When your response involves regulatory compliance or gap analysis, structure your response as JSON with this format:
{
  "type": "regulation_card",
  "citation": "OSHA 29 CFR 1910.XXXX",
  "title": "Standard Name",
  "requirements": [
    {"item": "requirement description", "status": "covered|missing", "detail": "explanation"}
  ],
  "covered_count": N,
  "total_count": N,
  "summary": "plain language summary",
  "recommendations": ["action items"]
}

If the question is NOT about regulations, respond with plain text as normal.
Always cite the specific CFR section number. Never guess at regulatory requirements.
If uncertain about a specific requirement, say so and recommend consulting the regulation directly."""


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

    # Build framework coverage summary
    framework_gaps = tenant_context.get("framework_gaps", [])
    coverage_lines = []
    for g in framework_gaps:
        status = g.get("coverage_status", "unknown")
        category = g.get("framework_category", "Unknown")
        tier = g.get("framework_tier", "?")
        gap_list = g.get("gaps", [])
        gap_str = f" -- gaps: {', '.join(gap_list)}" if gap_list else ""
        coverage_lines.append(f"  Tier {tier} | {category} | {status}{gap_str}")
    coverage_summary = "\n".join(coverage_lines) if coverage_lines else "  No framework analysis data yet."

    # Build recent incidents summary
    recent_incidents = tenant_context.get("recent_incidents", [])
    if recent_incidents:
        incident_lines = []
        for inc in recent_incidents:
            incident_lines.append(
                f"  [{inc.get('severity', 'unknown')}] {inc.get('title', 'Untitled')} "
                f"({inc.get('status', 'unknown')}) - {inc.get('date', 'no date')}"
            )
        incidents_summary = "\n".join(incident_lines)
    else:
        incidents_summary = "  No recent incidents."

    # Build open CAPAs summary
    open_capa_list = tenant_context.get("open_capa_list", [])
    if open_capa_list:
        capa_lines = []
        for capa in open_capa_list:
            capa_lines.append(
                f"  [{capa.get('priority', 'unknown')}] {capa.get('title', 'Untitled')} "
                f"(status: {capa.get('status', 'unknown')}, due: {capa.get('due_date', 'no date')})"
            )
        capas_summary = "\n".join(capa_lines)
    else:
        capas_summary = "  No open CAPAs."

    context_str = f"""
Current tenant data:
- Open incidents: {tenant_context.get('open_incidents', 0)}
- Open/in-progress CAPAs: {tenant_context.get('open_capas', 0)}
- Framework analysis chunks: {len(framework_gaps)}

Framework Coverage:
{coverage_summary}

Recent Incidents:
{incidents_summary}

Open CAPAs:
{capas_summary}
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
