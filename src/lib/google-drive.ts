import { google } from "googleapis";

export type DriveSheet = { id: string; name: string; modifiedTime: string | null; url: string };

export function googleServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("ยังไม่ได้ตั้งค่า Google Drive service account");
  return new google.auth.JWT({ email, key: privateKey, scopes: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/spreadsheets.readonly"] });
}

export async function listQueueSourceSheets() {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("ยังไม่ได้ตั้งค่า GOOGLE_DRIVE_FOLDER_ID");
  const auth = googleServiceAccountAuth();
  const drive = google.drive({ version: "v3", auth });
  const { data } = await drive.files.list({ q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`, fields: "files(id,name,modifiedTime,webViewLink)", orderBy: "modifiedTime desc", pageSize: 100 });
  return (data.files ?? []).filter((file): file is { id: string; name: string; modifiedTime?: string | null; webViewLink?: string | null } => Boolean(file.id && file.name)).map((file) => ({ id: file.id, name: file.name, modifiedTime: file.modifiedTime ?? null, url: file.webViewLink ?? `https://docs.google.com/spreadsheets/d/${file.id}` }));
}
