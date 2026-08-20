#!/bin/sh
. /usr/lib/ai-router/tools.sh
API_KEY=$(uci -q get airouter.${AI_PROVIDER_ID}.api_key)
MODEL=$(uci -q get airouter.${AI_PROVIDER_ID}.model || echo "gpt-4o-mini")
API_BASE=$(uci -q get airouter.${AI_PROVIDER_ID}.api_base || echo "https://api.openai.com/v1")
HISTORY_FILE="/etc/ai-router/history.json"
if [ -z "$API_KEY" ]; then
	echo '{"content": "Error: API key is not configured for this provider."}'
	exit 0
fi
TOOLS=$(get_tools_json)
MESSAGES=$(cat "$HISTORY_FILE")
SYSTEM_JSON=$(jq -n --arg text "$AI_SYSTEM_PROMPT" '[{"role":"system","content":$text}]')
MESSAGES=$(echo "$MESSAGES" | jq --argjson sys "$SYSTEM_JSON" '$sys + .')
PAYLOAD=$(jq -n --arg model "$MODEL" --argjson messages "$MESSAGES" --argjson tools "$TOOLS" '{model: $model, messages: $messages, tools: $tools, temperature: 0.1}')
RESPONSE=$(curl -s "${API_BASE}/chat/completions" -H "Content-Type: application/json" -H "Authorization: Bearer $API_KEY" -d "$PAYLOAD")
MSG=$(echo "$RESPONSE" | jq -c '.choices[0].message')
if [ "$MSG" = "null" ] || [ -z "$MSG" ]; then
	ERROR=$(echo "$RESPONSE" | jq -r '.error.message // "Unknown API error"')
	echo "{\"content\": \"API Error: $ERROR\"}"
else
	echo "$MSG"
fi
