# CyberMaturity Platform — LLM Prompts

All `InvokeLLM` prompts used across the project, organized by feature.

---

## 1. Assessment Completion — Generate Recommendations
**File:** `pages/AssessmentDetail.jsx`  
**Trigger:** User clicks "Complete & Analyze" after filling out an assessment.

```
You are a cybersecurity compliance expert. Analyze these assessment responses and generate actionable recommendations.

Assessment data: ${JSON.stringify(responseSummary)}

For each significant gap (current level < target level), provide a recommendation. Focus on the most impactful improvements.
Return 5-8 prioritized recommendations.
```

**Response schema fields:** `framework_code`, `domain`, `control_id`, `priority` (critical/high/medium/low), `title`, `description`, `current_level`, `target_level`, `effort` (low/medium/high), `timeline` (immediate/short_term/medium_term/long_term)

---

## 2. AI Assessment Wizard — Select Relevant Questions
**File:** `components/assessments/AssessmentWizardAI.jsx`  
**Trigger:** User clicks "AI Select" when creating a new assessment with AI mode.

```
You are a cybersecurity compliance expert. Select the most relevant questions for this assessment.

Customer: ${selectedCustomer?.name || 'Unknown'}
Sector: ${sectorLabel}
Frameworks: ${fwList}
Requested number of questions: ${numQuestions}

From the list below, select the ${numQuestions} most relevant and impactful questions for this customer's sector and the specified frameworks.
Aim for good coverage across domains. Return ONLY the question IDs you select (up to ${numQuestions}).

Available questions:
${JSON.stringify(questionList)}
```

**Response schema fields:** `selected_ids` (array of question ID strings)

---

## 3. AI Question Generator — Gap Analysis & New Questions
**File:** `components/questions/AIQuestionGeneratorDialog.jsx`  
**Trigger:** User clicks "Analyze & Generate" in the Question Bank AI dialog.

```
You are a cybersecurity compliance expert. Analyze the following existing assessment questions and identify coverage gaps.

Existing questions:
${JSON.stringify(summary, null, 2)}

Target frameworks for gap analysis:
${JSON.stringify(frameworkContext, null, 2)}

Generate 6-10 new, high-quality assessment questions that fill coverage gaps.
CRITICAL RULES:
- Set "framework_code" to EXACTLY one of the codes listed above (e.g. "QNRC", "NIS2", "ISO27001", "NIST_CSF", "CIS_V8", "ENISA").
- Set "domain" to EXACTLY one of the valid_domains listed for that framework_code. Do NOT invent new domain names.
- For QNRC questions, use control_id format like "ID.GA-3", "PR.SD-3", "DE.MC-2", etc. matching the domain prefix.
- For QNRC questions, provide both English (question_text) and European Portuguese (question_text_pt) translations.
- Use maturity_scale answer type.
```

**Response schema fields:** `framework_code`, `domain`, `control_id`, `question_text`, `question_text_pt`, `guidance`, `weight`, `answer_type`, `order_index`; also `analysis` (string)

---

## 4. AI Recommendation Generator
**File:** `components/recommendations/AIRecommendationDialog.jsx`  
**Trigger:** User clicks "Generate" in the Recommendations AI dialog.

```
You are a cybersecurity compliance expert. Generate actionable improvement recommendations for the ${fw?.name || framework} framework.
${customer ? `Organization context: ${customer.name}, sector: ${customer.sector?.replace(/_/g, ' ')}, size: ${customer.num_employees} employees.` : ''}

Generate 6-8 high-quality, specific, and actionable recommendations covering different domains of the ${framework} framework.
Each recommendation should be practical and address common compliance gaps.
Vary the priorities (include critical, high, medium, and low).
Include clear titles, detailed descriptions, effort estimates, and suggested timelines.
```

**Response schema fields:** `framework_code`, `domain`, `control_id`, `priority` (critical/high/medium/low), `title`, `description`, `effort` (low/medium/high), `timeline` (immediate/short_term/medium_term/long_term)

---

## 5. Translate Questions to European Portuguese
**File:** `pages/QuestionBank.jsx`  
**Trigger:** User clicks "Translate to PT" button in the Question Bank. Runs in batches of 10 questions.

```
You are a professional translator specialising in European Portuguese (Portugal), not Brazilian Portuguese.
Translate the following cybersecurity assessment questions and their guidance texts to European Portuguese (Portugal).
Use formal register ("você"/"a organização"), European vocabulary and spelling (e.g. "implementação" not "implementação", avoid Brazilian colloquialisms).

Questions to translate (JSON array):
${JSON.stringify(batch.map(q => ({ id: q.id, question_text: q.question_text, guidance: q.guidance || '' })), null, 2)}

Return only valid JSON with the translations.
```

**Response schema fields:** `translations` array with `id`, `question_text_pt`, `guidance_pt`

---

## Notes

- All prompts use `base44.integrations.Core.InvokeLLM` with a `response_json_schema` to get structured JSON back.
- Prompts 1–4 use the default model. Prompt 5 (translation) also uses the default model but runs in batches to keep prompt size manageable.
- No LLM prompts exist in backend functions — all AI calls are made from the frontend.