import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { StyledInput } from './ui/StyledInput';

const intakeSchema = z.object({
  language: z.string().min(1, 'Please choose a language'),
  dob: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().max(20, 'Too long').optional().or(z.literal('')),
  need: z
    .string()
    .trim()
    .min(1, 'Please tell us what you need')
    .max(300, 'Please keep it under 300 characters'),
  distance: z.number().min(1).max(50),
});

type IntakeFormValues = z.infer<typeof intakeSchema>;

export interface IntakeLocation {
  latitude: number;
  longitude: number;
  label: string;
}

export interface IntakeData extends IntakeFormValues {
  currentLocation: IntakeLocation | null;
}

interface Props {
  visible: boolean;
  currentLocation: IntakeLocation | null;
  locationStatus: string;
  onComplete: (data: IntakeData) => void;
}

const LANGUAGES = [
  'English', 'Español', '中文 (Chinese)', 'Tiếng Việt', 'العربية (Arabic)',
  'Tagalog', 'Français', 'Português', 'Русский', '한국어 (Korean)',
  '日本語 (Japanese)', 'Deutsch', 'Italiano', 'हिन्दी (Hindi)', 'Polski',
  'Kreyòl Ayisyen',
];

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export const IntakeModal = ({
  visible,
  currentLocation,
  locationStatus,
  onComplete,
}: Props) => {
  const [langOpen, setLangOpen] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');

  const { control, handleSubmit, watch, setValue, formState } = useForm<IntakeFormValues>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      language: 'English',
      dob: '',
      gender: 'Male',
      phone: '',
      need: 'I would like a place to stay tonight',
      distance: 2,
    },
    mode: 'onChange',
  });

  const distance = watch('distance');
  const language = watch('language');
  const gender = watch('gender');

  const filteredLangs = LANGUAGES.filter((l) =>
    l.toLowerCase().includes(langSearch.toLowerCase()),
  );

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#A8B8F0', '#E8B898', '#FCD68C'] as unknown as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orb}
            />
            <Text style={styles.title}>Let's get you{'\n'}the right help.</Text>
            <Text style={styles.subtitle}>
              A few quick questions — everything stays private.
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 480 }}
            contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 28, paddingTop: 8, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Language */}
            <Field label="Language" error={formState.errors.language?.message}>
              <Pressable style={styles.selectTrigger} onPress={() => setLangOpen(true)}>
                <Text style={styles.selectText}>{language}</Text>
                <Text style={styles.chev}>⌄</Text>
              </Pressable>
            </Field>

            {/* DOB + Gender */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field label="Date of birth" hint="optional" style={{ flex: 1 }}>
                <Controller
                  control={control}
                  name="dob"
                  render={({ field: { value, onChange } }) => (
                    <StyledInput
                      placeholder="YYYY-MM-DD"
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
              </Field>

              <Field label="Gender" hint="optional" style={{ flex: 1 }}>
                <Pressable style={styles.selectTrigger} onPress={() => setGenderOpen(true)}>
                  <Text style={styles.selectText}>{gender}</Text>
                  <Text style={styles.chev}>⌄</Text>
                </Pressable>
              </Field>
            </View>

            {/* Phone */}
            <Field label="Phone" hint="for callback — optional">
              <Controller
                control={control}
                name="phone"
                render={({ field: { value, onChange } }) => (
                  <StyledInput
                    placeholder="(555) 555-5555"
                    keyboardType="phone-pad"
                    value={value}
                    onChangeText={onChange}
                    maxLength={20}
                  />
                )}
              />
            </Field>

            {/* Distance */}
            <View style={{ gap: 8, paddingTop: 4 }}>
              <View style={styles.distRow}>
                <Text style={styles.distLabel}>How far can you travel?</Text>
                <Text style={styles.distValue}>
                  {distance} {distance === 1 ? 'mile' : 'miles'}
                </Text>
              </View>
              <Slider
                minimumValue={1}
                maximumValue={25}
                step={1}
                value={distance}
                onValueChange={(v) => setValue('distance', v, { shouldValidate: true })}
                minimumTrackTintColor={colors.foreground}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.foreground}
              />
              <View style={styles.distRow}>
                <Text style={styles.distHint}>1 MI</Text>
                <Text style={styles.distHint}>25 MI</Text>
              </View>
            </View>

            <Button
              title="Continue"
              onPress={handleSubmit((d) =>
                onComplete({
                  ...d,
                  phone: d.phone?.trim() || '',
                  currentLocation,
                })
              )}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </View>

      {/* Language picker overlay */}
      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <TextInput
              autoFocus
              placeholder="Search languages…"
              placeholderTextColor={colors.mutedForeground}
              style={styles.pickerSearch}
              value={langSearch}
              onChangeText={setLangSearch}
            />
            <FlatList
              data={filteredLangs}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => {
                    setValue('language', item, { shouldValidate: true });
                    setLangOpen(false);
                    setLangSearch('');
                  }}
                >
                  <Text style={[styles.pickerItemText, language === item && { fontFamily: fonts.bodySemibold }]}>
                    {language === item ? '✓  ' : '   '}{item}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={{ padding: 16, textAlign: 'center', color: colors.mutedForeground }}>
                  No language found.
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gender picker */}
      <Modal visible={genderOpen} transparent animationType="fade" onRequestClose={() => setGenderOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setGenderOpen(false)}>
          <Pressable style={[styles.pickerCard, { maxHeight: 300 }]} onPress={(e) => e.stopPropagation()}>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                style={styles.pickerItem}
                onPress={() => {
                  setValue('gender', g);
                  setGenderOpen(false);
                }}
              >
                <Text style={[styles.pickerItemText, gender === g && { fontFamily: fonts.bodySemibold }]}>
                  {gender === g ? '✓  ' : '   '}{g}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.6)',
    ...shadow.modal,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 8,
  },
  orb: {
    height: 36,
    width: 36,
    borderRadius: 999,
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.foreground,
  },
  subtitle: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  selectTrigger: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.6)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.foreground,
  },
  chev: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  textarea: {
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
  locationBlock: {
    gap: 10,
  },
  locationStatus: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(239, 233, 221, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(228, 221, 208, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  locationStatusTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.foreground,
  },
  locationStatusText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  distRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  distLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: 'rgba(42, 36, 56, 0.8)',
  },
  distValue: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.foreground,
  },
  distHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mutedForeground,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: 480,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.modal,
  },
  pickerSearch: {
    height: 44,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.foreground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerItemText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.foreground,
  },
});
