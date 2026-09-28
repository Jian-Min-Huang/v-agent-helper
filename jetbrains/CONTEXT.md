# Codex Helper

在 IntelliJ 內把編輯器裡的檔案位置送進已經開著的 Codex CLI，讓使用者不用在 Codex 裡自己搜尋檔案、補行號。

## Language

**Reference（引用）**: Send to Codex 貼進 Codex 輸入列的文字，內容是相對於目前 IntelliJ 專案根目錄的檔案路徑，可以附帶選取的行號範圍；專案外的檔案使用絕對路徑。同一次 Broadcast 的所有接收者會收到相同的 Reference。
_Avoid_: file tag、mention、`@` 引用、依 Codex instance 工作目錄產生的路徑

**Codex instance（Codex 實例）**: 目前 IntelliJ project 的 Terminal tab 中正在執行的一個 Codex CLI；一般 shell 與其他 project 的 Terminal tab 不算。
_Avoid_: terminal、Codex tab

**Broadcast（廣播）**: 一次 Send to Codex 將 Reference 放入目前 project 的所有 Codex instance。
_Avoid_: 發送給全部 terminal
