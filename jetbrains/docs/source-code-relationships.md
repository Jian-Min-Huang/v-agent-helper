# 原始碼關聯圖

這張圖呈現一次 **Send to Codex** 操作從 IntelliJ Action 入口、Reference 建立、Codex instance 辨識，到最後廣播傳送的主要關聯。

```mermaid
flowchart TD
    User["使用者：選取程式碼<br/>Send to Codex"]

    subgraph Entry["codexhelper（外掛入口）"]
        XML["plugin.xml<br/>註冊選單與工具列 Action"]
        Action["SendToCodexAction.kt<br/>存檔、讀取檔案與選取範圍"]
    end

    subgraph Reference["codexhelper.reference（建立 Reference）"]
        Range["LineRange.kt<br/>選取位置 → 行號範圍"]
        Formatter["CodexReferenceFormatter.kt<br/>路徑與行號 → Reference"]
    end

    subgraph Service["codexhelper.service（流程協調）"]
        Sender["CodexTerminalSender.kt<br/>整體流程協調者"]
    end

    subgraph TerminalLogic["codexhelper.terminal（辨識與廣播）"]
        State["TerminalTabState.kt<br/>判斷 Terminal 狀態與 Codex 指令"]
        Process["TerminalProcessTree.kt<br/>Powerlevel10k 備援偵測"]
        Broadcast["CodexBroadcast.kt<br/>篩選接收者、逐一傳送、收集失敗"]
    end

    subgraph Platform["IntelliJ Platform"]
        Terminal["IntelliJ Terminal API<br/>Bracketed Paste"]
        Notice["IntelliJ Notification<br/>找不到 Codex／傳送失敗"]
    end

    XML -->|註冊| Action
    User --> Action
    Action -->|選取起點、終點| Range
    Action -->|檔案路徑與 LineRange| Sender

    Sender -->|格式化一次| Formatter
    Range --> Formatter

    Sender -->|建立狀態並判斷| State
    Sender -->|Shell integration 不可用時| Process
    Process -->|Process commands| State

    Sender -->|Reference 與候選 instances| Broadcast
    Broadcast -->|每個 Codex instance| Terminal
    Broadcast -->|傳送結果| Sender
    Sender -->|沒有接收者或部分失敗| Notice

```

閱讀時可以從 `plugin.xml` 和根 package 的 `SendToCodexAction.kt` 開始，接著沿著實線箭頭追到 `service/CodexTerminalSender.kt`；Reference 的建立集中在 `reference` package，Terminal 狀態、Codex 指令辨識與廣播則集中在 `terminal` package。
