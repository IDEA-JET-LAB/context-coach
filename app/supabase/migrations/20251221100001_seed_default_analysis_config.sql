-- Seed Default Analysis Configuration
-- Story 5.6: Analysis Configuration Management
-- Seeds the default analysis config with 5 dimensions

-- ============================================
-- DEFAULT ANALYSIS CONFIG
-- ============================================
INSERT INTO analysis_configs (id, version, name, system_prompt, model, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  1,
  'Default Scoring v1',
  'You are an expert prompt engineering coach. Analyze the following prompt and score it on multiple dimensions. Be constructive, specific, and actionable in your feedback. Your goal is to help users write better prompts that get better results from AI assistants.',
  'gpt-4o-mini',
  true
);

-- ============================================
-- DEFAULT DIMENSIONS (weights sum to 100)
-- Clarity: 25%, Context: 25%, Specificity: 20%, Goal: 15%, Constraints: 15%
-- ============================================

-- Clarity (25%)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Clarity',
  'How clear and unambiguous is the prompt? Can it be understood without additional context?',
  25,
  'Evaluate how clearly the prompt communicates the request. Consider ambiguity, sentence structure, and whether the intent is obvious.',
  '1-3: Confusing, multiple interpretations possible, poor grammar
4-5: Somewhat clear but has ambiguous elements
6-7: Generally clear with minor ambiguities
8-9: Very clear, easy to understand
10: Crystal clear, no possible misinterpretation',
  true,
  1
);

-- Context (25%)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Context',
  'Is sufficient background information provided? Does the reader understand the situation?',
  25,
  'Evaluate whether enough context is provided to understand the request. Consider background info, environment details, and relevant history.',
  '1-3: No context, impossible to understand situation
4-5: Minimal context, missing key background
6-7: Adequate context, some gaps
8-9: Good context, well-framed
10: Excellent context, complete picture provided',
  true,
  2
);

-- Specificity (20%)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Specificity',
  'Are requirements specific and detailed? Are vague terms avoided?',
  20,
  'Evaluate how specific and detailed the requirements are. Look for concrete details vs vague generalizations.',
  '1-3: Very vague, no specific details
4-5: Some specifics but many undefined terms
6-7: Reasonably specific with room for improvement
8-9: Highly specific, detailed requirements
10: Extremely detailed, nothing left to interpretation',
  true,
  3
);

-- Goal (15%)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Goal',
  'Is the desired outcome clearly stated? Will you know when you''ve succeeded?',
  15,
  'Evaluate whether the end goal is clear. Consider success criteria and how someone would know when the task is complete.',
  '1-3: No goal stated, unclear what success looks like
4-5: Goal implied but not explicit
6-7: Goal stated but success criteria unclear
8-9: Clear goal with measurable outcome
10: Perfect goal definition with explicit success criteria',
  true,
  4
);

-- Constraints (15%)
INSERT INTO analysis_dimensions (config_id, name, description, weight, prompt_template, scoring_criteria, enabled, sort_order)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Constraints',
  'Are limitations and boundaries defined? Are there clear parameters to work within?',
  15,
  'Evaluate whether constraints and boundaries are defined. Consider limitations, preferences, and scope boundaries.',
  '1-3: No constraints, completely open-ended
4-5: Few constraints, mostly undefined scope
6-7: Some constraints but gaps exist
8-9: Well-defined constraints and boundaries
10: Comprehensive constraints, all parameters clear',
  true,
  5
);
