function onFormSubmit(e) {
  Logger.log("=== 1. 開始執行 onFormSubmit ===");

  // 防呆 1：確認是否由表單觸發
  if (!e || !e.response) {
    Logger.log("【錯誤】未偵測到表單觸發事件 (e.response)。請勿手動點擊「執行」，請透過「提交 Google 表單」測試。");
    return;
  }

  // 防呆 2：讀取 API Key
  const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    Logger.log("【錯誤】未設定 GEMINI_API_KEY 指令碼屬性！請至專案設定檢查。");
    return;
  } else {
    Logger.log("【成功】成功讀取 API Key，開頭為：" + GEMINI_API_KEY.substring(0, 5) + "...");
  }

  // 安全讀取表單回應內容
  const itemResponses = e.response.getItemResponses();
  Logger.log("【資訊】收到表單回應欄位數量：" + itemResponses.length);

  // 檢查表單欄位數量是否足夠 (假設表單有 4 個題目)
  if (itemResponses.length < 4) {
    Logger.log("【錯誤】表單回應欄位少於 4 個！可能有些必填欄位未填寫。目前收到的回應為：");
    for (let i = 0; i < itemResponses.length; i++) {
      Logger.log(`- 欄位 ${i}: ` + itemResponses[i].getResponse());
    }
    return;
  }

  // 讀取欄位內容
  const speakerName   = String(itemResponses[0].getResponse());
  const sermonTitle   = String(itemResponses[1].getResponse());
  const reviewerEmail = String(itemResponses[2].getResponse());

  // -------------------------------------------------------------
  // 解析上傳的檔案並提取內文
  // -------------------------------------------------------------
  let sermonText = "";
  try {
    const fileResponse = itemResponses[3].getResponse();
    // 表單檔案上傳會回傳檔案 ID 陣列，取第一個檔案 ID
    const fileId = Array.isArray(fileResponse) ? fileResponse[0] : fileResponse;
    Logger.log("【資訊】偵測到上傳檔案 ID：" + fileId);

    sermonText = extractTextFromFileId(fileId);
    Logger.log("【成功】成功解析檔案文字，字數：" + sermonText.length);
    Logger.log("【資訊】檔案前 50 字：" + sermonText.substring(0, 50) + "...");
  } catch (fileErr) {
    Logger.log("【錯誤】讀取檔案失敗：" + fileErr.toString());
    return;
  }

  if (!sermonText || sermonText.trim().length === 0) {
    Logger.log("【錯誤】無法讀取到有效的檔案內文！");
    return;
  }

  // 設定 System Prompt
  const systemPrompt = `
你是一位嚴謹的教會講道覆核稽核員。
請分析以下講道稿內容，進行抄襲與相似度查核：
1. 自動過濾與排除「聖經經文本身」與「常見禱告詞」。
2. 提取講稿中的「核心論點、獨特比喻、故事或金句」。
3. 使用 Google 搜尋 tools 檢查網路上是否有高相似度的文章、書籍或講道記錄。
4. 評估是否有潛在未註明出處的抄襲風險。

最後請產出一份簡潔的【講道覆核初審報告】，包含：
- 總體風險等級 (綠色Safe / 黃色Warning / 紅色Risk)
- 疑似相似/引用的段落與來源網址
- 給覆核同工的具體建議
`;

  // 準備呼叫 Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    "contents": [
      {
        "role": "user",
        "parts": [{ "text": systemPrompt + "\n\n【講道稿內容】：\n" + sermonText }]
      }
    ],
    //註:免費版 google api search 功能有用量限制,如果google ai studio 發現模型 RPM 那些沒有使用但持續報 error:429 可以註解下面這行繼續使用
    "tools": [{ "google_search": {} }]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  Logger.log("=== 2. 發送 API 請求給 Gemini ===");

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const rawContent = response.getContentText();

    Logger.log("【資訊】HTTP 狀態碼：" + statusCode);

    if (statusCode !== 200) {
      Logger.log("【錯誤】API 回傳非 200 狀態碼！回應內容：\n" + rawContent);
      return;
    }

    const result = JSON.parse(rawContent);

    // 防呆 3：檢查 candidates 是否存在 (關鍵除錯點！)
    if (!result.candidates || result.candidates.length === 0) {
      Logger.log("【錯誤】Gemini 回傳內容中沒有 candidates 陣列！可能原因：內容觸發安全過濾阻擋。");
      Logger.log("原始 JSON 回傳內容：\n" + JSON.stringify(result, null, 2));
      return;
    }

    if (!result.candidates[0].content || !result.candidates[0].content.parts || !result.candidates[0].content.parts[0]) {
      Logger.log("【錯誤】candidates[0] 結構異常，找不到文字內容 parts[0]。");
      Logger.log("candidates[0] 內容：\n" + JSON.stringify(result.candidates[0], null, 2));
      return;
    }

    // 成功取得文字內容
    const reportContent = result.candidates[0].content.parts[0].text;
    Logger.log("【成功】成功取得 Gemini 生成報告，長度：" + reportContent.length + " 字");

    // 發送 Email 報告
    Logger.log("=== 3. 準備寄出 Email ===");
    const emailSubject = `【講道覆核報告】${sermonTitle} - ${speakerName}`;
    const emailBody = `親愛的同工：\n\n已完成講道稿初步 AI 稽核，報告如下：\n\n--------------------------------\n${reportContent}\n--------------------------------\n\n註：本報告由 AI 自動生成，請作最終人工確認。`;

    MailApp.sendEmail(reviewerEmail, emailSubject, emailBody);
    Logger.log("【成功】報告已寄至：" + reviewerEmail);

  } catch (error) {
    Logger.log("【例外錯誤】程式執行中發生未預期錯誤：" + error.toString());
  }

  Logger.log("=== 4. 流程結束 ===");
}

function extractTextFromFileId(fileId) {
const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();

  // 1. 如果已經是 Google Docs 格式
  if (mimeType === MimeType.GOOGLE_DOCS) {
    return DocumentApp.openById(fileId).getBody().getText();
  }

  // 2. 如果是純文字檔 (.txt)
  if (mimeType === MimeType.PLAIN_TEXT) {
    return file.getBlob().getDataAsString();
  }

  // 3. 如果是 Word (.docx) 或 PDF，準備轉檔參數（已明確宣告 resource 變數）
  const resource = {
    name: "[Temp] " + file.getName(),  // Drive API v3 屬性
    title: "[Temp] " + file.getName(), // Drive API v2 屬性
    mimeType: MimeType.GOOGLE_DOCS
  };

  let tempFile;

  // 自動判斷目前使用的是 Drive API v2 還是 v3
  if (typeof Drive !== 'undefined' && typeof Drive.Files !== 'undefined') {
    if (typeof Drive.Files.insert === 'function') {
      // Drive API v2 語法
      tempFile = Drive.Files.insert(resource, file.getBlob(), { ocr: true });
    } else if (typeof Drive.Files.create === 'function') {
      // Drive API v3 語法
      tempFile = Drive.Files.create(resource, file.getBlob(), { ocr: true });
    } else {
      throw new Error("Drive API 版本不符合，請確認左側「服務」中已開啟 Drive API。");
    }
  } else {
    throw new Error("尚未啟用 Drive API 服務！請在左側「服務 (Services)」點擊 + 新增 Drive API。");
  }

  // 打開轉換後的臨時 Google Doc 抓取純文字
  const doc = DocumentApp.openById(tempFile.id);
  const text = doc.getBody().getText();

  // 讀取完畢後自動刪除臨時建立的 Google Doc 檔案，不佔用空間
  DriveApp.getFileById(tempFile.id).setTrashed(true);

  return text;
}