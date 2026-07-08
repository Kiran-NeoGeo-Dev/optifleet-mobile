import { useState, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface Country { code: string; name: string; dial: string; }

const COUNTRIES: Country[] = [
  { code: "IN", name: "India",                dial: "+91"  },
  { code: "US", name: "United States",        dial: "+1"   },
  { code: "GB", name: "United Kingdom",       dial: "+44"  },
  { code: "AU", name: "Australia",            dial: "+61"  },
  { code: "CA", name: "Canada",               dial: "+1"   },
  { code: "AE", name: "UAE",                  dial: "+971" },
  { code: "SA", name: "Saudi Arabia",         dial: "+966" },
  { code: "SG", name: "Singapore",            dial: "+65"  },
  { code: "MY", name: "Malaysia",             dial: "+60"  },
  { code: "NZ", name: "New Zealand",          dial: "+64"  },
  { code: "ZA", name: "South Africa",         dial: "+27"  },
  { code: "NG", name: "Nigeria",              dial: "+234" },
  { code: "KE", name: "Kenya",                dial: "+254" },
  { code: "GH", name: "Ghana",                dial: "+233" },
  { code: "PK", name: "Pakistan",             dial: "+92"  },
  { code: "BD", name: "Bangladesh",           dial: "+880" },
  { code: "LK", name: "Sri Lanka",            dial: "+94"  },
  { code: "NP", name: "Nepal",                dial: "+977" },
  { code: "PH", name: "Philippines",          dial: "+63"  },
  { code: "ID", name: "Indonesia",            dial: "+62"  },
  { code: "TH", name: "Thailand",             dial: "+66"  },
  { code: "VN", name: "Vietnam",              dial: "+84"  },
  { code: "CN", name: "China",                dial: "+86"  },
  { code: "JP", name: "Japan",                dial: "+81"  },
  { code: "KR", name: "South Korea",          dial: "+82"  },
  { code: "DE", name: "Germany",              dial: "+49"  },
  { code: "FR", name: "France",               dial: "+33"  },
  { code: "IT", name: "Italy",                dial: "+39"  },
  { code: "ES", name: "Spain",                dial: "+34"  },
  { code: "NL", name: "Netherlands",          dial: "+31"  },
  { code: "SE", name: "Sweden",               dial: "+46"  },
  { code: "NO", name: "Norway",               dial: "+47"  },
  { code: "DK", name: "Denmark",              dial: "+45"  },
  { code: "FI", name: "Finland",              dial: "+358" },
  { code: "CH", name: "Switzerland",          dial: "+41"  },
  { code: "AT", name: "Austria",              dial: "+43"  },
  { code: "BE", name: "Belgium",              dial: "+32"  },
  { code: "PT", name: "Portugal",             dial: "+351" },
  { code: "PL", name: "Poland",               dial: "+48"  },
  { code: "RU", name: "Russia",               dial: "+7"   },
  { code: "TR", name: "Turkey",               dial: "+90"  },
  { code: "EG", name: "Egypt",                dial: "+20"  },
  { code: "MA", name: "Morocco",              dial: "+212" },
  { code: "BR", name: "Brazil",               dial: "+55"  },
  { code: "MX", name: "Mexico",               dial: "+52"  },
  { code: "AR", name: "Argentina",            dial: "+54"  },
  { code: "CO", name: "Colombia",             dial: "+57"  },
  { code: "CL", name: "Chile",                dial: "+56"  },
  { code: "IL", name: "Israel",               dial: "+972" },
  { code: "QA", name: "Qatar",                dial: "+974" },
  { code: "KW", name: "Kuwait",               dial: "+965" },
  { code: "BH", name: "Bahrain",              dial: "+973" },
  { code: "OM", name: "Oman",                 dial: "+968" },
  { code: "JO", name: "Jordan",               dial: "+962" },
  { code: "LB", name: "Lebanon",              dial: "+961" },
  { code: "IQ", name: "Iraq",                 dial: "+964" },
  { code: "IR", name: "Iran",                 dial: "+98"  },
  { code: "HK", name: "Hong Kong",            dial: "+852" },
  { code: "TW", name: "Taiwan",               dial: "+886" },
  { code: "MM", name: "Myanmar",              dial: "+95"  },
  { code: "KH", name: "Cambodia",             dial: "+855" },
  { code: "LA", name: "Laos",                 dial: "+856" },
  { code: "MN", name: "Mongolia",             dial: "+976" },
  { code: "AF", name: "Afghanistan",          dial: "+93"  },
  { code: "UZ", name: "Uzbekistan",           dial: "+998" },
  { code: "KZ", name: "Kazakhstan",           dial: "+7"   },
  { code: "UA", name: "Ukraine",              dial: "+380" },
  { code: "GR", name: "Greece",               dial: "+30"  },
  { code: "CZ", name: "Czech Republic",       dial: "+420" },
  { code: "HU", name: "Hungary",              dial: "+36"  },
  { code: "RO", name: "Romania",              dial: "+40"  },
  { code: "BG", name: "Bulgaria",             dial: "+359" },
  { code: "HR", name: "Croatia",              dial: "+385" },
  { code: "RS", name: "Serbia",               dial: "+381" },
  { code: "SK", name: "Slovakia",             dial: "+421" },
  { code: "SI", name: "Slovenia",             dial: "+386" },
  { code: "EE", name: "Estonia",              dial: "+372" },
  { code: "LV", name: "Latvia",               dial: "+371" },
  { code: "LT", name: "Lithuania",            dial: "+370" },
  { code: "BY", name: "Belarus",              dial: "+375" },
  { code: "MD", name: "Moldova",              dial: "+373" },
  { code: "GE", name: "Georgia",              dial: "+995" },
  { code: "AM", name: "Armenia",              dial: "+374" },
  { code: "AZ", name: "Azerbaijan",           dial: "+994" },
  { code: "TZ", name: "Tanzania",             dial: "+255" },
  { code: "UG", name: "Uganda",               dial: "+256" },
  { code: "ET", name: "Ethiopia",             dial: "+251" },
  { code: "SD", name: "Sudan",                dial: "+249" },
  { code: "CM", name: "Cameroon",             dial: "+237" },
  { code: "CI", name: "Ivory Coast",          dial: "+225" },
  { code: "SN", name: "Senegal",              dial: "+221" },
  { code: "TN", name: "Tunisia",              dial: "+216" },
  { code: "DZ", name: "Algeria",              dial: "+213" },
  { code: "LY", name: "Libya",                dial: "+218" },
  { code: "PE", name: "Peru",                 dial: "+51"  },
  { code: "VE", name: "Venezuela",            dial: "+58"  },
  { code: "EC", name: "Ecuador",              dial: "+593" },
  { code: "BO", name: "Bolivia",              dial: "+591" },
  { code: "PY", name: "Paraguay",             dial: "+595" },
  { code: "UY", name: "Uruguay",              dial: "+598" },
  { code: "CR", name: "Costa Rica",           dial: "+506" },
  { code: "PA", name: "Panama",               dial: "+507" },
  { code: "GT", name: "Guatemala",            dial: "+502" },
  { code: "CU", name: "Cuba",                 dial: "+53"  },
  { code: "DO", name: "Dominican Republic",   dial: "+1"   },
  { code: "JM", name: "Jamaica",              dial: "+1"   },
  { code: "TT", name: "Trinidad & Tobago",    dial: "+1"   },
];

interface Props {
  value: string;       // dial code e.g. "+91"
  onChange: (dial: string) => void;
  inputBg?: string;
  inputBorder?: string;
  inputText?: string;
  placeholder?: string;
  error?: boolean;
}

export const CountryCodePicker = ({
  value, onChange, inputBg = "#E8C9A0", inputBorder = "rgba(160,90,30,0.35)",
  inputText = "#3B1F0A", error = false,
}: Props) => {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() =>
    query.trim()
      ? COUNTRIES.filter(c =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query)
        )
      : COUNTRIES,
    [query]
  );

  const selected = COUNTRIES.find(c => c.dial === value) ?? COUNTRIES[0];

  return (
    <>
      <TouchableOpacity
        style={[s.trigger, { backgroundColor: inputBg, borderColor: error ? "rgba(239,68,68,0.55)" : inputBorder }]}
        onPress={() => { setQuery(""); setOpen(true); }}
        activeOpacity={0.8}
      >
        <Text style={[s.triggerTxt, { color: inputText }]}>{selected.dial}</Text>
        <Ionicons name="chevron-down" size={13} color="#A0785A" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.backdrop} onPress={() => setOpen(false)} activeOpacity={1}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <Text style={s.sheetTitle}>Select Country Code</Text>
            <View style={s.searchBox}>
              <Ionicons name="search" size={14} color="#6B7280" />
              <TextInput
                style={s.searchInput}
                placeholder="Search country or code…"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                autoFocus
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={filtered}
              keyExtractor={item => item.code}
              style={s.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.item, item.dial === value && s.itemActive]}
                  onPress={() => { onChange(item.dial); setOpen(false); }}
                >
                  <Text style={s.itemDial}>{item.dial}</Text>
                  <Text style={s.itemName}>{item.name}</Text>
                  {item.dial === value && <Ionicons name="checkmark" size={15} color="#1565C0" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  trigger:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 42, gap: 4, minWidth: 72 },
  triggerTxt:  { fontSize: 13, fontWeight: "700" },
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  sheet:       { backgroundColor: "#fff", borderRadius: 16, width: "88%", maxHeight: "72%", overflow: "hidden", elevation: 10, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  sheetTitle:  { fontSize: 14, fontWeight: "800", color: "#0D1B3E", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchBox:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 10, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: "#0D1B3E" },
  list:        { maxHeight: 340 },
  item:        { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 16, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)" },
  itemActive:  { backgroundColor: "rgba(21,101,192,0.07)" },
  itemDial:    { fontSize: 13, fontWeight: "700", color: "#1565C0", width: 48 },
  itemName:    { flex: 1, fontSize: 13, color: "#374151" },
});
