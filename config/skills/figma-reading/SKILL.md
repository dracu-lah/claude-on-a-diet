---
name: figma-reading
description: Use when a task touches a Figma design or a figma.com URL and the values (geometry, colors, typography) must be read from the real file.
---

Read the real file with the Figma MCP (`mcp__claude_ai_Figma__*`, already authenticated):
`get_metadata` for the node tree, `get_design_context` and `get_variable_defs` for values,
`get_screenshot` to confirm. Never guess geometry, colors, blend modes or typography the file can
tell you, and look beyond the URL's node (backgrounds, glows, light/dark twins). If the design and
the repo's conventions conflict, say so.
