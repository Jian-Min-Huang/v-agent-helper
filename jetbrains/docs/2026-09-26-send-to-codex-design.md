# Send to Codex — 設計文件

- 日期：2026-09-26
- 狀態：已實作

## 背景與目標

在 IntelliJ 內建 Terminal 裡使用 Codex CLI 時，沒辦法像 Claude Code 的 JetBrains plugin（⌥⌘K）那樣，直接把編輯器中的檔案或選取範圍當作 context 送進已經開著的 Codex。現在的做法是在 Codex 輸入列打 `@` 搜尋檔案，要指定範圍時再自己在路徑結尾補上行號。

這個 plugin 在編輯器右鍵選單，以及選取文字時浮在上方的工具列（以下稱浮動工具列），加上「Send to Codex」，把目前檔案的位置（含行號）廣播到目前 IntelliJ project 內每個正在執行的 Codex instance 輸入列。

**成功的樣子：** 選取程式碼 → 右鍵或浮動工具列 → Send to Codex → 每個 Codex instance 的輸入列各出現一次相同的 `src/Foo.kt#L10-L20`，Editor、Terminal tool window 與選中 tab 都維持原狀。

## 範圍

**要做：**
- 編輯器右鍵選單的「Send to Codex」action
- 浮動工具列（`Floating.CodeToolbar`）也放同一個 action，不用開右鍵選單就能送
- 有選取時帶行號，沒選取時只送檔案路徑
- 自動找出目前 project 中所有正在跑 codex 的 Codex instance 並廣播

**不做（第一版）：**
- Project 檔案樹右鍵、編輯器分頁標題右鍵
- `Floating.CodeToolbar` 以外的浮動工具列：JavaScript、TypeScript、HTML 用 JavaScript plugin 自己的 `Floating.CodeToolbar.JS`，Markdown 用 Markdown plugin 的排版工具列 `Markdown.Toolbar.Floating`，兩者都不包含 `Floating.CodeToolbar`；要放進去得對這兩個 plugin 宣告 optional 依賴。Claude Code 的 plugin 也只放 `Floating.CodeToolbar`。這些檔案照樣可以從右鍵選單送
- 送程式碼原文（只送位置，由 Codex 自己讀檔）
- Classic Terminal 支援：Powerlevel10k 的 Nerd Font 圖示只有新版 Terminal 的繪製引擎能正常顯示，所以不會使用 Classic 模式，也不特別偵測它
- 找不到 Codex 時自動開新 tab 並啟動 `codex`
- 預設快捷鍵（使用者可在 Keymap 自行綁定；Claude Code plugin 已佔用 ⌥⌘K）

## 技術棧

- Kotlin + Gradle（Kotlin DSL）
- IntelliJ Platform Gradle Plugin 2.x
- 目標平台：IntelliJ IDEA 2026.1（`sinceBuild = 261`），JDK 21
- 依賴內建 plugin `org.jetbrains.plugins.terminal`（使用新版 Terminal 的 frontend API）
- Plugin ID：`tw.jianminhuang.codexhelper`，顯示名稱：`Codex Helper`

## 會用到的 Terminal API（已在 2026.1.3 / build 261.25134.95 用 javap 確認）

以下介面都標有 `@ApiStatus.Experimental`：

| 用途 | API |
|---|---|
| 列出 tab | `TerminalToolWindowTabsManager.getInstance(project).tabs` → `List<TerminalToolWindowTab>` |
| tab 內容 | `TerminalToolWindowTab.view: TerminalView`、`.content: Content` |
| 送文字 | `TerminalView.createSendTextBuilder().useBracketedPasteMode().send(text)` |
| 目前執行中的指令 | `TerminalView.shellIntegrationDeferred` → `TerminalShellIntegration.blocksModel.activeBlock` |
| 指令內容 | `TerminalCommandBlock.executedCommand`、`.exitCode` |
| tab 的啟動指令 | `TerminalView.startupOptionsDeferred` → `TerminalStartupOptions.shellCommand`、`.processType` |
| session 是否還在跑 | `TerminalView.sessionState`（`TerminalViewSessionState.Running`） |

`TerminalShellIntegration` 上只有 `addShellBasedCompletionListener` 是 `@ApiStatus.Internal`，這個 plugin 不會用到。

## 元件

### 1. `SendToCodexAction`
- 註冊在 `EditorPopupMenu` 和 `Floating.CodeToolbar`，兩處都是 `anchor="last"`，文字「Send to Codex」。Claude Code 的「Send to Claude Code」也是註冊在這兩個 group（`claude-code-jetbrains-plugin` 0.1.14-beta 的 `plugin.xml`）。哪些檔案有浮動工具列見「風險與待確認事項」
- Icon 用 OpenAI 官方的 Blossom logo（`icons/codex.svg` 黑色給亮色主題、`icons/codex_dark.svg` 白色給暗色主題），跟 Claude Code 的「Send to Claude Code」一樣在選單裡顯示品牌圖示。官方檔案四周的留白已經裁掉，讓圖形填滿 16×16。浮動工具列的按鈕只顯示 icon，「Send to Codex」變成 tooltip
- `update()`：只有在編輯器對應到本機檔案（`LocalFileSystem`）時才顯示，右鍵選單和浮動工具列都一樣
- `actionPerformed()`：先存檔（`FileDocumentManager.saveDocument`），再讀出檔案路徑與主游標的選取範圍，轉換成行號，交給 `CodexTerminalSender`
- 沒有預設快捷鍵

### 2. `CodexReferenceFormatter`（純 Kotlin，不依賴 IntelliJ API）
- 輸入：檔案絕對路徑、目前 IntelliJ project root、可選的行號範圍（`LineRange`）
- 輸出：要送出的字串，例如 `␣src/Foo.kt#L10-L20␣`（`␣` 代表一個空白，見「格式規則」）
- 「選取範圍 → 行號範圍」是另一個純函式 `LineRange.ofSelection`（見下方「行號規則」），輸入是選取起點與終點的 0-based 行、欄（`TextPosition`），由 `SendToCodexAction` 從主游標的 offset 換算

### 3. `CodexBroadcast`
- 從所有候選 tab 中選出每個正在執行 Codex 的接收者（見「Broadcast 接收者」）
- 「是不是 codex 指令」的判斷寫成純函式 `isCodexCommand(command: String): Boolean`（在 `terminal/TerminalTabState.kt`）
- `CodexBroadcast.send` 接收已格式化一次的 Reference 與簡化過的 `CodexInstanceCandidate`，依序嘗試所有接收者；個別失敗會收集在結果中，不中斷後續嘗試

### 4. `CodexTerminalSender`（project-level service）
- 用目前 project root 呼叫 `CodexReferenceFormatter` 一次，讓所有接收者得到完全相同的 Reference
- 列出目前 project 的 Terminal tabs、辨識其中每個 Codex instance，再呼叫 `CodexBroadcast`
- 對每個接收者使用 bracketed paste，不送出 Enter；既有未送出的輸入不會排除該接收者
- 不打開 Terminal tool window、不切換 tab、不移動 focus
- 全部嘗試結束後，才用一則通知彙整失敗

## 資料流

```
右鍵或浮動工具列 → Send to Codex
  → SendToCodexAction：存檔、取得檔案路徑與選取範圍
  → CodexTerminalSender：
      CodexReferenceFormatter 以目前 project root 產生一次 Reference
      辨識目前 project 內的所有 Codex instance（沒有就發通知並結束）
      CodexBroadcast 對每個接收者依序嘗試 bracketed paste（不按 Enter）
      全部嘗試完成後，以一則通知彙整失敗；Editor focus 維持不變
```

## 格式規則

Reference 的寫法跟 Codex 自己的 `@` 檔案選單插入的文字一樣（codex-cli 0.157.1，`codex-rs/tui/src/bottom_pane/chat_composer.rs` 的 `insert_selected_path`），讓模型看到的文字跟使用者手動引用時相同。下面的 `␣` 代表一個空白。

### 行號規則（1-based，只看主游標）

| 情況 | 輸出 |
|---|---|
| 沒選取 | `␣src/Foo.kt␣` |
| 選取在同一行 | `␣src/Foo.kt#L12␣` |
| 選取跨多行 | `␣src/Foo.kt#L10-L20␣` |
| 選取結尾落在某一行的第 0 欄（例如整行選取） | 結尾行不算進那一行，例如選取 L10 開頭到 L21 第 0 欄 → `#L10-L20` |

- 開頭一律加一個空白，避免路徑黏到輸入列裡已經打好的字。Codex 送出前會把開頭的空白去掉；開頭有空白時也不會做 slash command 檢查，所以根目錄的檔案（例如 `/Foo.kt`）不會被當成未知指令
- 結尾一律加一個空白，方便接著打字
- 不送 Enter

### 路徑規則

- Reference 永遠以目前 IntelliJ project root 格式化一次，不讀取各 Codex instance 的工作目錄
- 檔案在 project root 底下 → 相對路徑，一律用 `/` 分隔
- 檔案不在 project root 底下 → 絕對路徑
- 同一次 Broadcast 的所有接收者收到相同文字
- 路徑含空白 → 用雙引號包起來，行號放在引號外，例如 `␣"test dir/a.txt"#L3␣`；路徑本身含 `"` 時不加引號。跟 Codex 選單的做法一樣

### 為什麼不加 `@`

- Codex 的 `@` 只用來開檔案選單：選了檔案後，Codex 會把整個 `@token` 換成純路徑；送出時也不會解析 `@path`，模型收到的是一般文字，檔案內容由它自己讀
- 貼上 `@path` 後，如果使用者把游標移回那段文字，選單會重新跳出，這時選了檔案會把 `#L…` 蓋掉。不加 `@` 就不會發生

## Broadcast 接收者

一次 Send to Codex 會送給目前 IntelliJ project 的每個 Codex instance，而且每個只送一次。一般 shell、其他 IntelliJ project 的 Terminal tab，以及不支援的 Classic Terminal session 都不是接收者。傳送依序執行，但不對外保證順序；不再根據選中 tab、上次送過的 tab 或第一個 Codex instance 路由。

沒有任何 Codex instance 時發出原有警告，不送出任何文字。

### 「正在跑 codex」的判斷

tab 的 session 還在跑（`sessionState` 是 `Running`），而且符合以下其中一種：

- **在 shell 裡執行 codex：** `activeBlock` 是 `TerminalCommandBlock`、`exitCode == null`，而且 `executedCommand` 是 codex 指令
- **shell integration 沒有就緒（包含 Powerlevel10k）：** 從啟動資訊取得 shell PID，該 process 或仍存活的 descendant command 是 codex 指令
- **由 Terminal 的 AI Agents 按鈕啟動：** tab 的 `processType` 是 `NON_SHELL`（process 本身就是 codex，外面沒有 shell，所以不會有 command block），而且啟動指令 `shellCommand` 是 codex 指令

「是 codex 指令」指符合其中一條：
- 第一個 token 的檔名是 `codex`，例如 `codex`、`/opt/homebrew/bin/codex`、`codex --model x`
- 任一 token 是 `@openai/codex` 或以 `@openai/codex@` 開頭，例如 `npx @openai/codex`

不符合的例子：`codexx`、`echo codex`、`git status`。

## 錯誤處理

所有通知使用「Codex Helper」通知群組（balloon）。

| 情況 | 處理 |
|---|---|
| 編輯器不是本機檔案（例如 jar 裡的 class） | 右鍵選單和浮動工具列都不顯示 action |
| 沒有任何 tab 在跑 codex（包括連一個 terminal tab 都沒有） | 通知「找不到正在執行的 Codex，請先在 Terminal 執行 codex」 |
| Terminal 是 Classic 模式 | 不特別偵測。`TerminalToolWindowTabsManager` 沒有 tab，所以跟沒有 codex tab 一樣，通知「找不到正在執行的 Codex」 |
| 某個 tab 的 shell integration 沒有就緒（`shellIntegrationDeferred` 尚未完成） | 不等待；改查 terminal 啟動 PID 的 process tree。PID 不存在、process 已結束或 JVM 無權讀取時，當作不是 codex tab |
| 某個接收者送出時拋出例外 | 記錄例外後繼續嘗試後續接收者；全部完成後用一則「Send to Codex 失敗」通知彙整失敗（`ProcessCanceledException` 等控制流程例外照常往外丟） |

## 測試

### 自動測試（純 Kotlin 單元測試）

- `LineRange.ofSelection`：沒選取、單行、多行、結尾在第 0 欄、整行選取
- `CodexReferenceFormatter`：沒有行號、單行、多行、檔案在 project root 外（改用絕對路徑）、路徑含空白（加引號）、路徑含空白也含 `"`（不加引號）
- `isCodexCommand`：
  - 是：`codex`、`/opt/homebrew/bin/codex --model x`、`npx @openai/codex`
  - 不是：`codexx`、`echo codex`、`git status`
- process tree fallback：能讀取 root process 與仍存活的 descendant；PID 不存在時回傳空清單
- Powerlevel10k regression：沒有 shell integration、但 process tree 內有 codex 時，仍判定為 codex tab
- `CodexBroadcast`：只選出所有 Codex instance、沒有接收者、每個接收者只送一次、所有接收者收到相同 Reference、個別失敗後仍嘗試後續接收者並回報失敗

### 手動驗證（`./gradlew runIde` 沙盒）

1. 在同一個 project 開兩個 Terminal tab，分別從 shell 與 AI Agents 按鈕啟動 Codex；另開一個一般 shell tab
2. 在編輯器選取幾行 → 右鍵 → Send to Codex
3. 確認：
   - 相同文字各出現在兩個 Codex instance 的輸入列一次，一般 shell 沒有收到，文字沒有被執行
   - 行號正確
   - focus 仍在 Editor，Terminal tool window 與選中的 tab 都沒有改變
4. 對路徑含空白的檔案（例如 `test dir/a.txt`）送一次，確認路徑有加雙引號
5. 讓其中一個 Codex instance `cd` 到子目錄，另一個保留未送出的草稿，再送一次，確認兩者都收到以 project root 為基準的相同 Reference
6. 結束所有 Codex instance 後再送一次，確認出現原有通知，而且沒有任何 tab 收到文字
7. 使用 Powerlevel10k 的 zsh tab 手動執行 `codex`，送一次 Reference，確認能偵測並貼進該 tab；結束 codex 後再送一次，確認不會貼進普通 shell
8. 裝上 Claude Code 的 plugin，在 `.kt` 或 `.java` 檔選取幾行，浮動工具列出現後點 Codex 的 icon，確認：
   - 送出的 Reference 跟從右鍵選單送的一樣
   - 「Send to Claude Code」和「Send to Codex」兩個按鈕都在
   - icon 在亮色和暗色主題下都看得清楚
   - 在 `.yaml` 或 `.xml` 檔選取幾行，精簡版的浮動工具列上也有 Codex 的 icon
9. 在 jar 裡的 class（例如按住 ⌘ 點進 JDK 的類別）選取幾行，確認浮動工具列沒有 Codex 的 icon
10. `./gradlew verifyPlugin` 檢查相容性

## 風險與待確認事項

- **Experimental API：** 上述 Terminal API 在 IntelliJ 升版時可能變動，每次升版都要重新跑手動驗證。
- **模組依賴宣告（已確認）：** `TerminalToolWindowTabsManager` 和 `TerminalView` 位於 `intellij.terminal.frontend` content module，但只要 `<depends>org.jetbrains.plugins.terminal</depends>` 就能在執行期載入，不需要另外宣告該 module。（2026.1.3 runIde 實測）
- **Codex TUI 對 bracketed paste 的反應：** 舊格式 `@path ` 貼上後不會被執行，也不會觸發 `@` 檔案搜尋彈窗（2026.1.3 runIde 實測，AI Agents 按鈕開的 Codex tab）。拿掉 `@` 之後的格式還沒在 runIde 實測；從 Codex 原始碼看，開頭是 `/` 的路徑不會跳出 slash command 選單，送出時也會當成一般訊息。
- **`activeBlock` 的語意（已確認）：** codex 執行中時，`activeBlock` 確實是該指令的 command block，而且 `exitCode` 為 null；codex 結束後就不再符合。（2026.1.3 runIde 實測，bash tab）
- **Powerlevel10k 使用者沒有 command block（已處理並確認）：** IntelliJ 2026.1 偵測到 Powerlevel10k（`P9K_VERSION`）後，`command-block-support-reworked.zsh` 會因 IJPL-178955 直接 return，因此 `shellIntegrationDeferred` 不會完成。plugin 在這條路徑改以 `TerminalStartupOptions.pid` 搭配 JVM `ProcessHandle` 檢查 shell 與仍存活的 descendants；一般 shell integration 正常時仍以 command block 為準。（2026.1.3 runIde 實測）
- **哪些檔案有浮動工具列（2026.1.3 用 javap 和各 plugin 的 `plugin.xml` 確認；浮動工具列上的 Send to Codex 已照手動驗證第 8、9 步在 runIde 實測，跟 Claude Code 的 plugin 並排）：** IntelliJ 只替註冊了 `lang.floatingToolbar` 的語言顯示浮動工具列，由 `FloatingToolbarCustomizerKt.findActionGroupFor` 決定用哪個 group。`Floating.CodeToolbar` 這個 group id 和下面的清單都可能隨升版改變。
  - Java、Kotlin：完整的工具列，用 `Floating.CodeToolbar`
  - XML、YAML、JSON、Properties、Shell Script、CSS、Dockerfile、HTTP Request：精簡版（`minimal="true"`），一樣用 `Floating.CodeToolbar`。精簡版只在 IDE 的主要語言（`IdeLanguageCustomization.getPrimaryIdeLanguages()`）也有浮動工具列時才出現；IntelliJ IDEA 的主要語言是 Java 和 Kotlin（`JavaIdeLanguageCustomization`），所以會出現，其他 IDE 不一定
  - SQL：`Floating.CodeToolbar.SQL`，裡面引用了 `Floating.CodeToolbar`，所以也有
  - JavaScript、TypeScript、HTML、Markdown：用各自的 group，沒有 Send to Codex（見「不做」）
  - 純文字等沒有註冊的檔案：沒有浮動工具列，只能用右鍵選單
