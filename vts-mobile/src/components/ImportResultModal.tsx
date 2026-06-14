import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface ImportResult {
  total: number;
  success: number;
  failures: { row: number; reason: string }[];
}

interface Props {
  visible: boolean;
  result: ImportResult | null;
  onClose: () => void;
}

// Matches the app-wide palette used across all screens
const C = {
  bgDark:   "#0A1F44",
  bgMid:    "#0D3B8E",
  accent:   "#1565C0",
  cream:    "#F6F1E9",
  label:    "#3A245C",
  muted:    "#4A6A8E",
  inputText:"#3B1F0A",
  white:    "#FFFFFF",
  green:    "#22C55E",
  red:      "#EF4444",
};

const ImportResultModal = ({ visible, result, onClose }: Props) => {
  if (!result) return null;
  const failed = result.failures.length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>Import Results</Text>

          <View style={s.statsRow}>
            <Stat label="Total"    value={result.total}   color={C.accent} />
            <Stat label="Imported" value={result.success} color={C.green} />
            <Stat label="Failed"   value={failed}         color={failed ? C.red : C.green} />
          </View>

          {failed > 0 && (
            <>
              <Text style={s.failHeader}>Failure Reasons</Text>
              <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {result.failures.map((f, i) => (
                  <View key={i} style={s.failRow}>
                    <Ionicons name="alert-circle-outline" size={14} color={C.red} style={{ marginTop: 2 }} />
                    <Text style={s.failTxt}>
                      <Text style={s.failRowNum}>Row {f.row}: </Text>{f.reason}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          <TouchableOpacity style={s.btn} onPress={onClose}>
            <Text style={s.btnTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const Stat = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={s.stat}>
    <Text style={[s.statVal, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </View>
);

const s = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  card:       { backgroundColor: C.cream, borderRadius: 24, padding: 24, width: "88%", maxHeight: "75%", shadowColor: C.bgDark, shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
  title:      { fontSize: 18, fontWeight: "800", color: C.bgDark, textAlign: "center", marginBottom: 20 },
  statsRow:   { flexDirection: "row", justifyContent: "space-around", marginBottom: 16, backgroundColor: "rgba(21,101,192,0.06)", borderRadius: 14, paddingVertical: 14 },
  stat:       { alignItems: "center" },
  statVal:    { fontSize: 28, fontWeight: "800" },
  statLabel:  { fontSize: 12, fontWeight: "700", color: C.muted, marginTop: 2 },
  failHeader: { fontSize: 13, fontWeight: "800", color: C.red, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  scroll:     { maxHeight: 200, marginBottom: 16 },
  failRow:    { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  failTxt:    { flex: 1, fontSize: 13, color: C.inputText, lineHeight: 18 },
  failRowNum: { fontWeight: "700", color: C.label },
  btn:        { backgroundColor: C.bgMid, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  btnTxt:     { color: C.white, fontWeight: "800", fontSize: 15 },
});

export default ImportResultModal;
