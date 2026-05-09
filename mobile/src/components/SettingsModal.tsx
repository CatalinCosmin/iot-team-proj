import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DEFAULT_THRESHOLDS } from '../hooks/useThresholds';
import type { ThresholdSettings } from '../types';

type Props = {
  visible: boolean;
  thresholds: ThresholdSettings;
  onSave: (settings: ThresholdSettings) => void;
  onClose: () => void;
};

type DraftField = keyof Omit<ThresholdSettings, 'enabled'>;

export function SettingsModal({ visible, thresholds, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ThresholdSettings>(thresholds);
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});

  useEffect(() => {
    if (visible) {
      setDraft(thresholds);
      setErrors({});
    }
  }, [visible, thresholds]);

  function setNumericField(field: DraftField, raw: string) {
    const num = parseFloat(raw);
    setDraft((prev) => ({ ...prev, [field]: isNaN(num) ? raw : num }));
    if (isNaN(num) && raw !== '' && raw !== '-') {
      setErrors((prev) => ({ ...prev, [field]: 'Must be a number' }));
    } else {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<DraftField, string>> = {};
    if (draft.tempMin >= draft.tempMax)
      next.tempMin = 'Min must be less than Max';
    if (draft.humidMin >= draft.humidMax)
      next.humidMin = 'Min must be less than Max';
    if (draft.cooldownMinutes < 1)
      next.cooldownMinutes = 'Must be at least 1 minute';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(draft);
    onClose();
  }

  function handleReset() {
    setDraft(DEFAULT_THRESHOLDS);
    setErrors({});
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Alert Settings</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={styles.label}>Enable Alerts</Text>
              <Text style={styles.hint}>Get notified when readings pass thresholds</Text>
            </View>
            <Switch
              value={draft.enabled}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, enabled: v }))}
              trackColor={{ true: '#2563eb', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.section}>Temperature Thresholds (°C)</Text>
          <View style={styles.fieldRow}>
            <NumberField
              label="Min"
              value={String(draft.tempMin)}
              error={errors.tempMin}
              onChangeText={(v) => setNumericField('tempMin', v)}
              disabled={!draft.enabled}
            />
            <NumberField
              label="Max"
              value={String(draft.tempMax)}
              error={errors.tempMax}
              onChangeText={(v) => setNumericField('tempMax', v)}
              disabled={!draft.enabled}
            />
          </View>

          <Text style={styles.section}>Humidity Thresholds (%)</Text>
          <View style={styles.fieldRow}>
            <NumberField
              label="Min"
              value={String(draft.humidMin)}
              error={errors.humidMin}
              onChangeText={(v) => setNumericField('humidMin', v)}
              disabled={!draft.enabled}
            />
            <NumberField
              label="Max"
              value={String(draft.humidMax)}
              error={errors.humidMax}
              onChangeText={(v) => setNumericField('humidMax', v)}
              disabled={!draft.enabled}
            />
          </View>

          <Text style={styles.section}>Alert Cooldown</Text>
          <View style={styles.fieldRow}>
            <NumberField
              label="Minutes between repeated alerts"
              value={String(draft.cooldownMinutes)}
              error={errors.cooldownMinutes}
              onChangeText={(v) => setNumericField('cooldownMinutes', v)}
              disabled={!draft.enabled}
              flex={1}
            />
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Reset Defaults</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

type FieldProps = {
  label: string;
  value: string;
  error?: string;
  onChangeText: (v: string) => void;
  disabled?: boolean;
  flex?: number;
};

function NumberField({ label, value, error, onChangeText, disabled, flex = 1 }: FieldProps) {
  return (
    <View style={[styles.fieldWrap, { flex }]}>
      <Text style={[styles.fieldLabel, disabled && styles.disabledText]}>{label}</Text>
      <TextInput
        style={[styles.input, error && styles.inputError, disabled && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        editable={!disabled}
        selectTextOnFocus
        placeholderTextColor="#64748b"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    padding: 24,
    gap: 12,
  },
  section: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 4,
  },
  rowLabel: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputDisabled: {
    opacity: 0.4,
  },
  disabledText: {
    opacity: 0.4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
