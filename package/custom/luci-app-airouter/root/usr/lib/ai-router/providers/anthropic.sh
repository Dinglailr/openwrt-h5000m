#!/bin/sh

. /usr/lib/ai-router/tools.sh

API_KEY=$(uci -q get airouter.${AI_PROVIDER_ID}.api_key)
MODEL=$(uci -q get airouter.${AI_PROVIDER_ID}.model)
HISTORY_FILE="/etc/ai-router/history.json"

if [ -z "$API_KEY" ]; then
	echo '{"content": "Error: Anthropic API key is not configured."}'
	exit 0
fi

MESSAGES=$(cat "$HISTORY_FILE" | jq '[
	.[] | if .role == "tool" then
		{
			"role": "user",
			"content": [
				{
					"type": "tool_result",
					"tool_use_id": .tool_call_id,
					"content": .content
				}
			]
		}
	elif .tool_calls then
		{
			"role": "assistant",
			"content": (
				[
					(.content | if . == null then empty else {"type": "text", "text": .} end)
				] + 
				(.tool_calls | if type == "array" then [.[] | {
					"type": "tool_use",
					"id": .id,
					"name": .function.name,
					"input": (.function.arguments | fromjson)
				}] else [] end)
			)
		}
	else
		{
			"role": .role,
			"content": .content
		}
	end
]')

TOOLS=$(get_tools_json | jq '[
	.[] | {
		"name": .function.name,
		"description": .function.description,
		"input_schema": .function.parameters
	}
]')

PAYLOAD=$(jq -n \
	--arg model "$MODEL" \
	--arg system_prompt "$AI_SYSTEM_PROMPT" \
	--argjson messages "$MESSAGES" \
	--argjson tools "$TOOLS" \
	'{
		model: $model,
		max_tokens: 1024,
		system: $system_prompt,
		messages: $messages,
		tools: $tools
	}')

RESPONSE=$(curl -s "https://api.anthropic.com/v1/messages" \
	-H "x-api-key: $API_KEY" \
	-H "anthropic-version: 2023-06-01" \
	-H "content-type: application/json" \
	-d "$PAYLOAD")

TOOL_USE=$(echo "$RESPONSE" | jq '[.content[]? | select(.type == "tool_use") | {id: .id, type: "function", function: {name: .name, arguments: (.input | tojson)}}]')
TEXT=$(echo "$RESPONSE" | jq -r '([.content[]? | select(.type == "text") | .text] | join("\n")) // empty')

if [ "$TOOL_USE" != "[]" ] && [ -n "$TOOL_USE" ] && [ "$TOOL_USE" != "null" ]; then
	jq -n --arg text "$TEXT" --argjson tools "$TOOL_USE" '{"content": $text, "tool_calls": $tools}'
else
	ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
	if [ -n "$ERROR" ]; then
		echo "{\"content\": \"API Error: $ERROR\"}"
	else
		jq -n --arg text "$TEXT" '{"content": $text}'
	fi
fi
