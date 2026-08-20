#!/bin/sh

. /usr/lib/ai-router/tools.sh

API_KEY=$(uci -q get airouter.${AI_PROVIDER_ID}.api_key)
MODEL=$(uci -q get airouter.${AI_PROVIDER_ID}.model)
HISTORY_FILE="/etc/ai-router/history.json"

if [ -z "$API_KEY" ]; then
	echo '{"content": "Error: Gemini API key is not configured."}'
	exit 0
fi

MESSAGES=$(cat "$HISTORY_FILE" | jq '[
	.[] | if .role == "user" then
		{
			"role": "user",
			"parts": [{"text": .content}]
		}
	elif .role == "assistant" then
		{
			"role": "model",
			"parts": (
				[
					(.content | if . == null then empty else {"text": .} end)
				] + 
				(.tool_calls | if type == "array" then [.[] | {
					"functionCall": {
						"name": .function.name,
						"args": (.function.arguments | fromjson)
					}
				}] else [] end)
			)
		}
	elif .role == "tool" then
		{
			"role": "user",
			"parts": [
				{
					"functionResponse": {
						"name": .name,
						"response": {
							"name": .name,
							"content": .content
						}
					}
				}
			]
		}
	else
		empty
	end
]')

TOOLS=$(get_tools_json | jq '{
	"functionDeclarations": [
		.[] | {
			"name": .function.name,
			"description": .function.description,
			"parameters": .function.parameters
		}
	]
}')

PAYLOAD=$(jq -n 	--arg system_prompt "$AI_SYSTEM_PROMPT" 	--argjson messages "$MESSAGES" 	--argjson tools "[$TOOLS]" 	'{
		systemInstruction: {
			parts: [{
				text: $system_prompt
			}]
		},
		contents: $messages,
		tools: $tools,
		safetySettings: [
			{ "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
			{ "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
			{ "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
			{ "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
		]
	}')

RESPONSE=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=$API_KEY" 	-H "Content-Type: application/json" 	-d "$PAYLOAD")

ERROR=$(echo "$RESPONSE" | jq -r '.error.message // empty')
if [ -n "$ERROR" ]; then
	echo "{\"content\": \"API Error: $ERROR\"}"
	exit 0
fi

PARTS=$(echo "$RESPONSE" | jq '.candidates[0].content.parts')

TEXT=$(echo "$PARTS" | jq -r '([.[]? | select(.text != null) | .text] | join("\n")) // empty')
TOOL_CALLS=$(echo "$PARTS" | jq '[.[]? | select(.functionCall != null) | {id: ("call_" + .functionCall.name + "_" + (. | tostring | length | tostring)), type: "function", function: {name: .functionCall.name, arguments: (.functionCall.args | tojson)}}]')

if [ "$TOOL_CALLS" != "[]" ] && [ -n "$TOOL_CALLS" ] && [ "$TOOL_CALLS" != "null" ]; then
	jq -n --arg text "$TEXT" --argjson tools "$TOOL_CALLS" '{"content": $text, "tool_calls": $tools}'
else
	jq -n --arg text "$TEXT" '{"content": $text}'
fi
