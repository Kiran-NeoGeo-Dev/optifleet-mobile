import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  label: string;
  value: number;
  backgroundColor: string;
  icon?: string;
  onPress?: () => void;
}

export const StatusCard = ({ label, value, backgroundColor, icon, onPress }: Props) => {
  const content = (
    <View style={[styles.card, { backgroundColor }]}>
      {!!icon && (
        <View style={styles.iconBox}>
          <Ionicons name={icon as any} size={22} color="#fff" />
        </View>
      )}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    margin: 6,
  },
  card: {
    padding: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    minHeight: 130,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  value: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
  },
});

export default StatusCard;
