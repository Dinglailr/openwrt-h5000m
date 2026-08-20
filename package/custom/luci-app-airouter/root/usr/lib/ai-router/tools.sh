#!/bin/sh

get_tools_json() {
	local tool_desc=$(uci -q get airouter.settings.tool_description)
	if [ -z "$tool_desc" ]; then
		tool_desc="Run any shell command on the router. Use for diagnostics (ping, traceroute, ifstatus, logread), reading files (cat, head, tail), checking status (uptime, free, df, top, ip, iw, iwinfo), and any other system administration task the user requests."
	fi
	
	jq -n --arg desc "$tool_desc" '[
  {
    "type": "function",
    "function": {
      "name": "uci_get",
      "description": "Read a specific UCI config value.",
      "parameters": {
        "type": "object",
        "properties": {
          "config": {
            "type": "string",
            "description": "The configuration name (e.g., '\''network'\'', '\''wireless'\'', '\''firewall'\'')."
          },
          "section": {
            "type": "string",
            "description": "The section name."
          },
          "option": {
            "type": "string",
            "description": "The option name (optional)."
          }
        },
        "required": ["config", "section"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "uci_set",
      "description": "Modify a UCI config value.",
      "parameters": {
        "type": "object",
        "properties": {
          "config": { "type": "string" },
          "section": { "type": "string" },
          "option": { "type": "string" },
          "value": { "type": "string" }
        },
        "required": ["config", "section", "option", "value"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "uci_commit",
      "description": "Commit UCI changes.",
      "parameters": {
        "type": "object",
        "properties": {
          "config": {
            "type": "string",
            "description": "The config to commit. Leave empty to commit all."
          }
        }
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "run_shell_command",
      "description": $desc,
      "parameters": {
        "type": "object",
        "properties": {
          "command": {
            "type": "string",
            "description": "The command line to execute."
          }
        },
        "required": ["command"]
      }
    }
  }
]'
}

execute_tool() {
	local name="$1"
	local args="$2"
	
	case "$name" in
		"uci_get")
			local config=$(echo "$args" | jq -r '.config')
			local section=$(echo "$args" | jq -r '.section')
			local option=$(echo "$args" | jq -r '.option // empty')
			if [ -n "$option" ]; then
				uci -q get "${config}.${section}.${option}" || echo "Error or not found"
			else
				uci -q show "${config}.${section}" || echo "Error or not found"
			fi
			;;
		"uci_set")
			local config=$(echo "$args" | jq -r '.config')
			local section=$(echo "$args" | jq -r '.section')
			local option=$(echo "$args" | jq -r '.option')
			local value=$(echo "$args" | jq -r '.value')
			uci set "${config}.${section}.${option}=${value}" && echo "Success" || echo "Failed"
			;;
		"uci_commit")
			local config=$(echo "$args" | jq -r '.config // empty')
			if [ -n "$config" ]; then
				uci commit "$config" && echo "Success" || echo "Failed"
			else
				uci commit && echo "Success" || echo "Failed"
			fi
			;;
		"run_shell_command")
			local cmd=$(echo "$args" | jq -r '.command')
			# Execute with timeout
			sh -c "$cmd" 2>&1
			;;
		*)
			echo "Unknown tool: $name"
			;;
	esac
}
