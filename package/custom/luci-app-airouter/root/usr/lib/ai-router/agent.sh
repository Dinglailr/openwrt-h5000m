#!/bin/sh

. /usr/lib/ai-router/history.sh
. /usr/lib/ai-router/tools.sh

run_agent() {
	local user_message="$1"
	local provider_id="$2"
	
	init_history
	compress_history_if_needed
	
	if [ -n "$user_message" ]; then
		append_message "user" "$user_message"
	fi
	
	# Get engine for this provider
	local engine=$(uci -q get airouter.${provider_id}.engine)
	if [ -z "$engine" ]; then
		echo "Error: Provider '$provider_id' not found or has no engine defined."
		return 1
	fi
	
	export AI_PROVIDER_ID="$provider_id"
	
	local sys_prompt=$(uci -q get airouter.settings.system_prompt)
	if [ -z "$sys_prompt" ]; then
		sys_prompt="You are an AI router assistant built into OpenWrt. You have access to UCI and shell commands. Do NOT ask for permission to run tools to fulfill the user request. ALWAYS use the tools automatically to answer queries. Be concise."
	fi
	export AI_SYSTEM_PROMPT="$sys_prompt"
	
	while true; do
		local adapter="/usr/lib/ai-router/providers/${engine}.sh"
		if [ ! -x "$adapter" ]; then
			echo "Adapter not found: $adapter"
			return 1
		fi
		
		local response_json
		response_json=$(sh "$adapter")
		
		if [ -z "$response_json" ] || [ "$response_json" = "null" ]; then
			echo "Failed to get response from provider."
			return 1
		fi
		
		local content=$(echo "$response_json" | jq -r '.content // empty')
		local has_tool_calls=$(echo "$response_json" | jq 'has("tool_calls")')
		
		if [ "$has_tool_calls" = "true" ]; then
			local tool_calls=$(echo "$response_json" | jq -c '.tool_calls')
			append_tool_use "assistant" "$content" "$tool_calls"
			
			local num_tools=$(echo "$tool_calls" | jq 'length')
			local i=0
			while [ $i -lt $num_tools ]; do
				local t_id=$(echo "$tool_calls" | jq -r ".[$i].id")
				local t_name=$(echo "$tool_calls" | jq -r ".[$i].function.name")
				local t_args=$(echo "$tool_calls" | jq -r ".[$i].function.arguments")
				
				local t_result=$(execute_tool "$t_name" "$t_args")
				append_tool_result "$t_id" "$t_name" "$t_result"
				
				i=$((i + 1))
			done
			continue
		else
			append_message "assistant" "$content"
			echo "$content"
			break
		fi
	done
}

if [ "$1" = "run" ]; then
	shift
	run_agent "$1" "$2"
fi
