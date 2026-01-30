
# AI Tools Menu
ai_tools_menu() {
    while true; do
        display_main_header
        echo -e "${COLOR_CYAN}AI Tools & Local LLMs${NC}"
        echo ""
        
        local options=(
            "💻 Launch LM Studio"
            "🦙 Manage Ollama"
            "⬅️  Back"
        )
        
        interactive_menu "Select tool: › " "${options[@]}"
        local choice=$?
        
        if [ $choice -eq 255 ]; then return; fi
        
        case $choice in
            0) launch_lmstudio ;;
            1) launch_ollama_menu ;;
            2) return ;;
        esac
    done
}
