# 📖 智慧講道覆核與抄襲檢測工具 (Sermon Audit & Plagiarism Detection Bot)

> **結合 Google Apps Script (GAS)、Drive API OCR 轉檔技術與 Gemini AI Agent，實現自動化講道稿稽核與報告發送流程。**

---

## 💡 專案簡介與痛點解決

在教會與社群管理中，講道稿與專題分享的審核需要消耗大量人工時間。傳統審核難以快速比對文本相似度，且人工閱讀長文極耗資源。

本專案建構了一套**自動化 AI 稽核工作流**：
1. 講員透過 Google 表單提交講道稿 (支援 `.docx`, `.pdf`, `.txt`, Google Doc)。
2. 系統透過 **Drive API OCR** 自動讀取與解析多格式檔案內文。
3. 呼叫 **Gemini AI Agent**，運用 System Prompt 排除經文與常見禱告詞，萃取核心論點並評估相似度與潛在風險。
4. 稽核完成後自動生成【初審報告】並發送 Email 給覆核同工。

---

## 🛠️ 技術架構與工具 (Tech Stack)

* **Language:** JavaScript (ES6+)
* **Platform:** Google Apps Script (GAS)
* **DevOps & Tools:** VS Code, Google Clasp, Git/GitHub (Version Control)
* **AI & LLM:** Google Gemini API (`gemini-3.1-flash-lite`)
* **Google Cloud APIs:** Google Drive API (v2/v3 OCR text extraction), DocumentApp, MailApp, PropertiesService

---

## 🏗️ 系統運作架構圖 (Workflow)

```text
[ Google Form 表單提交 ]
         │
         ▼
[ GAS onFormSubmit 觸發器 ] ───► [ 讀取 Script Properties 金鑰 ]
         │
         ▼
[ Drive API OCR 文字解析 ] ───► (支援 Word, PDF, Google Doc 自動轉檔)
         │
         ▼
[ Gemini API 邏輯稽核 ] ───► (過濾經文、分析獨特論點、風險評級)
         │
         ▼
[ MailApp 發送結果 Email ] ───► (寄送初審報告給覆核同工)