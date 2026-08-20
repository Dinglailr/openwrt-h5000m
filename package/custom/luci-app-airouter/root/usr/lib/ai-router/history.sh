#!/bin/sh

HISTORY_FILE="/etc/ai-router/history.json"

init_history() {
	if [ ! -f "$HISTORY_FILE" ]; then
		echo "[]" > "$HISTORY_FILE"
	fi
}

get_history() {
	cat "$HISTORY_FILE"
}

append_message() {
	local role="$1"
	local content="$2"
	# Append using jq
	jq --arg role "$role" --arg content "$content" '. += [{"role": $role, "content": $content}]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
	mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
}

append_tool_use() {
	local role="$1"
	local content="$2"
	local tool_calls="$3"
	# tool_calls should be a JSON array of tool_call objects
	if [ -n "$content" ] && [ "$content" != "null" ]; then
		jq --arg role "$role" --arg content "$content" --argjson tool_calls "$tool_calls" '. += [{"role": $role, "content": $content, "tool_calls": $tool_calls}]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
	else
		jq --arg role "$role" --argjson tool_calls "$tool_calls" '. += [{"role": $role, "tool_calls": $tool_calls}]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
	fi
	mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
}

append_tool_result() {
	local tool_call_id="$1"
	local name="$2"
	local content="$3"
	jq --arg role "tool" --arg tool_call_id "$tool_call_id" --arg name "$name" --arg content "$content" '. += [{"role": $role, "tool_call_id": $tool_call_id, "name": $name, "content": $content}]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
	mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
}

clear_history() {
	echo "[]" > "$HISTORY_FILE"
}

compress_history_if_needed() {
	local length=$(jq 'length' "$HISTORY_FILE")
	if [ "$length" -gt 30 ]; then
		# Not implemented fully yet: we would take the first 10 messages, summarize, and replace.
		# For now, just drop oldest 10 messages to avoid breaking.
		# Keeping the system prompt (if any) is tricky, but OpenWrt use case we don't store system prompt in history.
		jq '.[10:]' "$HISTORY_FILE" > "${HISTORY_FILE}.tmp"
		mv "${HISTORY_FILE}.tmp" "$HISTORY_FILE"
	fi
}

if [ "$1" = "clear_history" ]; then
	clear_history
fi
