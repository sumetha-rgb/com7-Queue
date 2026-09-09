export type DriveSheet = { id: string; name: string; modifiedTime: string | null; url: string };

export async function listQueueSourceSheets(): Promise<DriveSheet[]> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!folderId || !apiKey) throw new Error("ยังไม่ได้ตั้งค่า Google Drive folder หรือ API key");
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id,name,modifiedTime,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: "100",
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error("ไม่สามารถอ่านไฟล์ Google Sheet จากโฟลเดอร์ได้");
  const data = await response.json() as { files?: { id: string; name: string; modifiedTime?: string; webViewLink?: string }[] };
  return (data.files ?? []).map((file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime ?? null, url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}/edit` }));
}