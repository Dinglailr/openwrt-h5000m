m = Map("airouter", translate("AI Router Settings"), translate("Configure the AI provider and API keys for the router agent."))

s = m:section(TypedSection, "settings", translate("Provider Settings"))
s.anonymous = true

p = s:option(ListValue, "provider", translate("Active Provider"))
p:value("openai", translate("OpenAI / DeepSeek / Compatible"))
p:value("anthropic", translate("Anthropic (Claude)"))
p:value("gemini", translate("Google Gemini"))

-- OpenAI Settings
o_key = s:option(Value, "openai_api_key", translate("OpenAI API Key"))
o_key.password = true
o_key:depends("provider", "openai")

o_model = s:option(Value, "openai_model", translate("OpenAI Model"))
o_model.default = "gpt-4o-mini"
o_model:depends("provider", "openai")

o_base = s:option(Value, "openai_api_base", translate("OpenAI API Base URL"))
o_base.default = "https://api.openai.com/v1"
o_base:depends("provider", "openai")

-- Anthropic Settings
a_key = s:option(Value, "anthropic_api_key", translate("Anthropic API Key"))
a_key.password = true
a_key:depends("provider", "anthropic")

a_model = s:option(Value, "anthropic_model", translate("Anthropic Model"))
a_model.default = "claude-3-5-haiku-20241022"
a_model:depends("provider", "anthropic")

-- Gemini Settings
g_key = s:option(Value, "gemini_api_key", translate("Gemini API Key"))
g_key.password = true
g_key:depends("provider", "gemini")

g_model = s:option(Value, "gemini_model", translate("Gemini Model"))
g_model.default = "gemini-2.0-flash"
g_model:depends("provider", "gemini")

return m
