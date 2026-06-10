import { GoogleGenAI } from "@google/genai";

const FALLBACK_MESSAGE = "⚠️ **AI Review Unavailable**: Please check that your Gemini API key in the **Settings > Secrets** panel is valid. Check server logs for details.";

function buildSystemPrompt(language: string): string {
  if (language === 'id') {
    return `Sebagai Senior Tech Lead, buat ringkasan tinjauan kode dari komit berikut.
Fokus pada logika bisnis dan arsitektur, bukan pada detail sepele.
Balas HANYA dengan format Markdown standar berikut tanpa teks pengantar, gunakan bahasa Indonesia yang natural dan tidak kaku (tetap gunakan istilah bahasa Inggris jika itu lebih umum di dunia pemrograman):

**Ringkasan Singkat:**
(1 kalimat utama ringkasan tentang apa yang dilakukan komit ini)

**Perubahan Utama:**
* (Poin penting untuk fungsionalitas/fitur baru yang diubah)
* (Poin penting lainnya jika ada)

**Dampak/Konteks:**
(Mengapa perubahan ini penting, dampaknya pada sistem, atau konteks rilis)`;
  }
  return `As a Senior Tech Lead, create a code review summary of the following commit.
Focus on business logic and architecture, not on trivial details.
Reply ONLY with the following standard Markdown format without any introductory text:

**TL;DR:**
(1 main summary sentence about what this commit does)

**Key Changes:**
* (Bullet point for changed functionality/new features)
* (Other bullet points if any)

**Impact/Context:**
(Why this change is important, its impact on the system, or release context)`;
}

export function buildUserContent(message: string, rawDiff: string): string {
  const safeMessage = message
    ? `[COMMIT_MESSAGE_START]\n${message}\n[COMMIT_MESSAGE_END]`
    : 'No commit message';
  const safeDiff = rawDiff || '';
  let truncatedDiff = safeDiff;
  if (safeDiff.length > 15000) {
    truncatedDiff = safeDiff.substring(0, 15000) + '\n\n... [Diff truncated due to length limitations]';
  }
  return `Commit Message:\n${safeMessage}\n\nGit Diff:\n\`\`\`\n${truncatedDiff}\n\`\`\``;
}

export async function generateSummary(
  apiKey: string,
  message: string,
  rawDiff: string,
  language: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = buildSystemPrompt(language);
  const userContent = buildUserContent(message, rawDiff);
  const prompt = systemPrompt + "\n\n" + userContent;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  for (let i = 0; i < models.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: models[i],
        contents: prompt,
      });
      if (!response.text) throw new Error(`No response from model ${models[i]}`);
      return response.text;
    } catch (err) {
      console.warn(`[TIER ${i + 1}] ${models[i]} failed:`, (err as Error).message);
    }
  }
  return FALLBACK_MESSAGE;
}
