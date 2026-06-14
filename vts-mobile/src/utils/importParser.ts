import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { read, utils } from "xlsx";

/**
 * Picks an Excel (.xlsx) or CSV (.csv) file and returns parsed rows as
 * an array of plain objects keyed by the header row values.
 */
export async function pickAndParseFile(): Promise<Record<string, string>[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "text/comma-separated-values",
      "application/csv",
    ],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return [];

  const asset = result.assets[0];

  // expo-file-system v2: use File class + arrayBuffer()
  const file = new File(asset.uri);
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json<Record<string, string>>(ws, {
    raw: false,
    defval: "",
  });

  return rows;
}
