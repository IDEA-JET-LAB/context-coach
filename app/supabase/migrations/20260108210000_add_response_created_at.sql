-- Add created_at parameter to insert_encrypted_response function
-- This allows imports to preserve original timestamps

-- Create new function with created_at parameter
-- Using a different approach: create as new function signature
CREATE OR REPLACE FUNCTION insert_encrypted_response(
  p_prompt_id UUID,
  p_response_text TEXT,
  p_tool_count INTEGER,
  p_tools_used TEXT[],
  p_model TEXT,
  p_tokens_in INTEGER,
  p_tokens_out INTEGER,
  p_has_thinking BOOLEAN,
  p_created_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO prompt_responses (
    prompt_id,
    response_text_encrypted,
    tool_count,
    tools_used,
    model,
    tokens_in,
    tokens_out,
    has_thinking,
    created_at
  ) VALUES (
    p_prompt_id,
    encrypt_response_text(p_response_text),
    p_tool_count,
    p_tools_used,
    p_model,
    p_tokens_in,
    p_tokens_out,
    p_has_thinking,
    p_created_at
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service_role
GRANT EXECUTE ON FUNCTION insert_encrypted_response(UUID, TEXT, INTEGER, TEXT[], TEXT, INTEGER, INTEGER, BOOLEAN, TIMESTAMPTZ) TO service_role;
