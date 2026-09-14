# bug-fullscreen-redirect

Minimal, framework-free MCP app to reproduce: on ChatGPT iOS, opening an external
link from a fullscreen widget shows the in-app browser sheet, then the host
collapses the widget to inline and the sheet is dismissed.

One tool (`show_card`), one HTML view, no bundler. The view speaks both
protocols: MCP Apps (ext-apps `App`, bundle inlined) and legacy Apps SDK
(`window.openai`, feature-detected). Logs render on-screen under the card.

    pnpm install
    pnpm start            # http://localhost:3001/mcp
    # expose it (ngrok http 3001, cloudflared, …) and add the public /mcp URL as a
    # ChatGPT app in developer mode, then ask: "show the card"

Flow: the card is split in two halves, one per protocol. Each half has a link
button; tapping the half itself requests fullscreen through that protocol. In
fullscreen the same two link buttons remain.
