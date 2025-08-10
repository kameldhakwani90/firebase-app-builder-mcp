#!/bin/bash

echo "🧪 Test des permissions MCP agents..."

# Générer un UUID valide
SESSION_ID=$(uuidgen)

echo "🔍 Test agent filesystem..."
claude --mcp-config /Users/mohamedkameldhakwani/.config/claude/mcp_servers.json --session-id $SESSION_ID "Test access to prixigrad-filesystem server. List the contents of /Users/mohamedkameldhakwani and show me the filesystem capabilities available."

echo ""
echo "🗄️  Test agent postgres..."
claude --mcp-config /Users/mohamedkameldhakwani/.config/claude/mcp_servers.json --session-id $(uuidgen) "Test access to prixigrad-postgres server and show available database capabilities."

echo ""
echo "🧠 Test agent sequential-thinking..."
claude --mcp-config /Users/mohamedkameldhakwani/.config/claude/mcp_servers.json --session-id $(uuidgen) "Test access to prixigrad-sequential server and demonstrate sequential thinking capabilities."

echo ""
echo "🏗️  Test agent prisma..."
claude --mcp-config /Users/mohamedkameldhakwani/.config/claude/mcp_servers.json --session-id $(uuidgen) "Test access to prixigrad-prisma server and show schema generation capabilities."

echo "✅ Tests des agents MCP terminés !"