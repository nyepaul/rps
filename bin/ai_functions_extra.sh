# Launch LM Studio
launch_lmstudio() {
    if [ "$ENABLE_LOCAL_LLM" = "false" ]; then
        warning_message "Local LLM support is disabled in settings."
        pause_for_user
        return 1
    fi
    
    local lmstudio_cmd="${LMSTUDIO_CMD:-lmstudio --no-sandbox}"
    echo -e "\n${COLOR_CYAN}═══ Launching LM Studio ═══${NC}\n"
    
    info_message "Running: $lmstudio_cmd"
    $lmstudio_cmd >/dev/null 2>&1 &
    
    success_message "LM Studio launched in background."
    pause_for_user
    return 0
}

# Ollama Menu
launch_ollama_menu() {
    if [ "$ENABLE_LOCAL_LLM" = "false" ]; then
        warning_message "Local LLM support is disabled in settings."
        pause_for_user
        return 1
    fi
    
    local ollama_cmd="${OLLAMA_CMD:-ollama}"
    
    while true; do
        display_main_header
        echo -e "${COLOR_CYAN}Ollama Manager${NC}"
        echo ""
        
        # Check status
        if pgrep -x "ollama" >/dev/null; then
            echo -e "Status: ${COLOR_GREEN}● Running${NC}"
        else
            echo -e "Status: ${COLOR_RED}● Stopped${NC}"
        fi
        echo ""
        
        local options=(
            "▶️  Start Ollama Service"
            "⏹️  Stop Ollama Service"
            "💬 Run Model (Interactive)"
            "📋 List Models"
            "⬇️  Pull Model"
            "⬅️  Back"
        )
        
        interactive_menu "Select option: › " "${options[@]}"
        local choice=$?
        
        if [ $choice -eq 255 ]; then return; fi
        
        case $choice in
            0) # Start
                if pgrep -x "ollama" >/dev/null; then
                    warning_message "Ollama is already running."
                else
                    info_message "Starting Ollama..."
                    $ollama_cmd serve >/dev/null 2>&1 &
                    sleep 2
                    success_message "Ollama started."
                fi
                pause_for_user
                ;;
            1) # Stop
                if pgrep -x "ollama" >/dev/null; then
                    info_message "Stopping Ollama..."
                    pkill -x "ollama"
                    success_message "Ollama stopped."
                else
                    warning_message "Ollama is not running."
                fi
                pause_for_user
                ;;
            2) # Run Model
                echo -ne "Enter model name (e.g., llama3): "
                read model_name
                if [ -n "$model_name" ]; then
                    $ollama_cmd run "$model_name"
                fi
                ;;
            3) # List
                $ollama_cmd list
                pause_for_user
                ;;
            4) # Pull
                echo -ne "Enter model to pull: "
                read model_name
                if [ -n "$model_name" ]; then
                    $ollama_cmd pull "$model_name"
                fi
                pause_for_user
                ;;
            5) # Back
                return
                ;;
        esac
    done
}
