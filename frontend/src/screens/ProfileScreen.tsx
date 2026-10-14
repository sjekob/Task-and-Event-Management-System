import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CatalogMultiSelect, CatalogOption } from '../components/CatalogMultiSelect';
import { CertificatesPanel } from '../components/CertificatesPanel';
import { ProfileSkeleton } from '../components/skeletonWidgets';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, IconButton, OutlinedButton, TextButton } from '../components/ui/buttons';
import { DropdownField, InputDecoration, Switch, TextField } from '../components/ui/inputs';
import { CircleAvatar, CircularProgressIndicator, useIsMobile } from '../components/ui/misc';
import { Dialog, showDialog, showSnackBar } from '../components/ui/overlay';
import { showDatePicker, lightPickerColors } from '../components/ui/pickers';
import { Education, User, UserSubject, tryParseDate } from '../models/models';
import { ApiService, exceptionText } from '../services/apiService';
import { useAppState } from '../services/appState';
import { PersonnelService } from '../services/personnelService';
import { AppTheme, TextStyles, densityDy, ts, tsAvatar, tsField } from '../theme/appTheme';
import { digitsOnly, titleCase } from '../utils/inputFormatters';

function roleLabel(role: string): string {
  switch (role) {
    case 'admin':       return 'Admin';
    case 'principal':   return 'Principal';
    case 'coordinator': return 'Coordinator';
    case 'dean':        return 'Dean';
    case 'registrar':   return 'Registrar';
    default:            return 'Teacher';
  }
}

/// "1984-03-15" -> "March 15, 1984" (left as-is if it isn't a date).
function longDate(iso: string | null): string | null {
  const d = iso == null ? null : tryParseDate(iso);
  if (d == null) return iso;
  const m = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December',
  ];
  return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

interface Field {
  label: string;
  value?: string | null;
  span?: number;
}

export default function ProfileScreen() {
  const app = useAppState();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await ApiService.getMyProfile();
      if (mounted.current) {
        setProfile(p);
        setLoading(false);
      }
    } catch (e) {
      if (mounted.current) {
        setLoading(false);
        setError(exceptionText(e));
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const role = app.userRole;

  const buildContent = () => {
    const p = profile!;
    return (
      <ScrollView
        contentContainerStyle={{
          paddingLeft: isMobile ? 14 : 24,
          paddingTop: 8,
          paddingRight: isMobile ? 14 : 24,
          paddingBottom: 32,
        }}
      >
        {/* ── Avatar card ── */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <CircleAvatar radius={36} backgroundColor={AppTheme.sidebarActive} style={{ overflow: 'hidden' }}>
              {p.avatarUrl != null ? (
                <Image source={{ uri: p.avatarUrl }} style={{ width: 72, height: 72 }} />
              ) : (
                <Text style={tsAvatar(24, 700, '#FFFFFF')}>{p.initials}</Text>
              )}
            </CircleAvatar>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={ts({ size: 18, weight: 700, color: AppTheme.textPrimary })}>{p.fullName}</Text>
              <View style={{ height: 2 }} />
              <Text style={TextStyles.bodyMd}>{roleLabel(p.role)}</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 14 }} />

        {/* ── Personal Information card ── */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[ts({ size: 15, weight: 700, color: AppTheme.textPrimary }), { flex: 1 }]}>
              Personal Information
            </Text>
            <OutlinedButton
              onPress={() => showDialog((pop) => <EditProfileDialog profile={p} onSaved={load} pop={() => pop()} />)}
              foregroundColor={AppTheme.textMuted}
              side={{ color: AppTheme.borderColor }}
              padding={[14, 8]}
              radius={8}
            >
              <Text style={TextStyles.labelMd}>Edit</Text>
            </OutlinedButton>
          </View>
          <View style={{ height: 8 }} />

          <SectionHeader icon="badge_outlined" title="Basic Information" />
          <InfoGrid
            isMobile={isMobile}
            fields={[
              { label: 'First Name', value: p.firstName },
              { label: 'Middle Name', value: p.middleName },
              { label: 'Last Name', value: p.lastName },
              { label: 'Suffix', value: p.suffix },
            ]}
          />

          <SectionHeader icon="contact_mail_outlined" title="Contact Information" />
          <InfoGrid
            isMobile={isMobile}
            fields={[
              { label: 'Email Address', value: p.email },
              { label: 'Phone Number', value: p.phoneNumber },
              { label: 'Address', value: p.address, span: 2 },
            ]}
          />

          <SectionHeader icon="family_restroom_outlined" title="Personal Details" />
          <InfoGrid
            isMobile={isMobile}
            fields={[
              { label: 'Birthdate', value: longDate(p.birthdate) },
              { label: 'Number of Children', value: `${p.numberOfChildren}` },
              { label: 'Elderly or Infant Care at Home', value: p.hasElderlyOrInfantCare ? 'Yes' : 'No' },
              { label: 'Available Beyond Regular Hours', value: p.overtimeOptIn ? 'Yes, opted in' : 'No' },
            ]}
          />

          <SectionHeader icon="work_outline" title="Employment" />
          <InfoGrid
            isMobile={isMobile}
            fields={[
              { label: 'Administrative Role', value: roleLabel(p.role) },
              { label: 'Date of Appointment', value: longDate(p.dateOfAppointment) },
            ]}
          />

          <SectionHeader icon="school_outlined" title="Educational Background" />
          <InfoGrid
            isMobile={isMobile}
            fields={[
              { label: 'Highest Educational Attainment', value: p.education.highestAttainment, span: 2 },
              { label: 'Undergraduate Degree', value: p.education.undergraduateDegree, span: 2 },
              { label: 'Area of Specialization', value: p.education.specialization, span: 2 },
              { label: 'Postgraduate Program Focus', value: p.education.postgraduateFocus, span: 2 },
            ]}
          />

          <SectionHeader icon="workspace_premium_outlined" title="Certifications & Eligibility" />
          <CertificatesPanel canUpload />

          <SectionHeader icon="psychology_outlined" title="Skills" />
          <ChipGroup label="Skills" items={p.skills} />
        </View>

        {/* ── Subject-grade assignment cards ── */}
        {p.subjects.length > 0 && (
          <>
            <View style={{ height: 14 }} />
            <SubjectGrid subjects={p.subjects} isMobile={isMobile} />
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }}>
      {/* App bar */}
      <View style={styles.appBar}>
        <View style={{ width: 56, alignItems: 'center' }}>
          <IconButton
            onPress={() => (router.canGoBack() ? router.back() : router.push('/dashboard' as never))}
            size={18}
            icon={<Icon name="arrow_back_ios_new" size={18} color={AppTheme.textPrimary} />}
          />
        </View>
        <Text numberOfLines={1} style={[ts({ size: 20, weight: 800, color: AppTheme.textPrimary }), { flex: 1 }]}>
          {roleLabel(role)}
        </Text>
        <View style={{ paddingRight: 12 }}>
          <TextButton
            onPress={() => {}}
            icon={<Icon name="help_outline" size={16} color={AppTheme.textMuted} />}
            backgroundColor={AppTheme.cardColor}
            padding={[14, 8]}
            radius={8}
          >
            <Text style={[TextStyles.labelMd, { color: AppTheme.textMuted }]}>FAQ</Text>
          </TextButton>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        {loading ? (
          <ProfileSkeleton />
        ) : error != null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="error_outline" color={AppTheme.redColor} size={40} />
            <View style={{ height: 12 }} />
            <Text style={TextStyles.bodyMd}>{error}</Text>
            <View style={{ height: 12 }} />
            <ElevatedButton onPress={load}>Retry</ElevatedButton>
          </View>
        ) : (
          buildContent()
        )}
      </View>
    </View>
  );
}

/// Fields laid out on a grid that uses the card's full width: 4 columns on
/// wide screens, 2 on medium, 1 on phones. A field's `span` widens it.
function InfoGrid({ isMobile, fields }: { isMobile: boolean; fields: Field[] }) {
  const [maxWidth, setMaxWidth] = useState(0);
  const gap = 32.0;
  const cols = isMobile ? 1 : maxWidth >= 900 ? 4 : 2;
  const colW = (maxWidth - gap * (cols - 1)) / cols;
  return (
    <View
      onLayout={(e) => setMaxWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: 24 }}
    >
      {maxWidth > 0 &&
        fields.map((f) => {
          const span = Math.min(Math.max(f.span ?? 1, 1), cols);
          return (
            <View key={f.label} style={{ width: colW * span + gap * (span - 1) }}>
              <Text style={ts({ size: 12, weight: 500, color: '#6B7280' })}>{f.label}</Text>
              <View style={{ height: 6 }} />
              <Text style={ts({ size: 14, weight: 600, color: AppTheme.textPrimary })}>
                {f.value != null && f.value.length > 0 ? f.value : '—'}
              </Text>
            </View>
          );
        })}
    </View>
  );
}

function ChipGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Text style={TextStyles.caption}>{label}</Text>
      <View style={{ height: 6 }} />
      {items.length === 0 ? (
        <Text style={TextStyles.bodyMd}>None added yet</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {items.map((t) => (
            <View key={t} style={styles.skillChip}>
              <Text style={ts({ size: 12.5, weight: 500, color: AppTheme.textPrimary })}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SubjectGrid({ subjects, isMobile }: { subjects: UserSubject[]; isMobile: boolean }) {
  const [width, setWidth] = useState(0);
  const cols = isMobile ? 1 : 2;
  const cellW = (width - 14 * (cols - 1)) / cols;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {width > 0 &&
        subjects.map((s, i) => (
          <View key={i} style={[styles.subjectCard, { width: cellW, height: cellW / 3.2 }]}>
            <Text style={[TextStyles.bodySm, { color: AppTheme.textMuted }]}>Subject-grade Assignment</Text>
            <View style={{ height: 4 }} />
            <Text style={ts({ size: 16, weight: 700, color: AppTheme.textPrimary })}>{s.subject}</Text>
            {s.gradeLevel != null && <Text style={TextStyles.bodyMd}>{s.gradeLevel}</Text>}
          </View>
        ))}
    </View>
  );
}

// ── Info field ─────────────────────────────────────────────────────────────────

/// Titled divider between groups of fields (profile view and edit dialog).
export function SectionHeader({ icon, title, dense = false }: {
  icon: IconName;
  title: string;
  /// Tighter spacing, used inside the Edit Profile dialog.
  dense?: boolean;
}) {
  return (
    <View style={{ paddingTop: dense ? 22 : 36, paddingBottom: dense ? 14 : 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={styles.sectionIcon}>
          <Icon name={icon} size={16} color={AppTheme.darkBanner} />
        </View>
        <View style={{ width: 10 }} />
        <Text style={ts({ size: 14, weight: 700, color: AppTheme.textPrimary })}>{title}</Text>
      </View>
      <View style={{ height: 12 }} />
      <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
    </View>
  );
}

// ── Edit dialog ────────────────────────────────────────────────────────────────

const NAME_KEYS = new Set(['first_name', 'middle_name', 'last_name', 'suffix']);
const DATE_KEYS = new Set(['birthdate', 'date_of_appointment']);

// Readable field labels: dark grey at rest, blue when focused/filled.
const labelStyle = ts({ size: 13, weight: 500, color: '#4B5563', height: 1.5, spacing: 0.5 });
const floatingLabelStyle = ts({ size: 13, weight: 600, color: '#1E3A8A', height: 1.5, spacing: 0.5 });
const FIELD_BORDER = '#B8C2D3';

const fieldDecoration: InputDecoration = {
  labelStyle,
  floatingLabelStyle,
  contentPadding: [12, 10],
  radius: 8,
  borderColor: FIELD_BORDER,
  borderWidth: 1,
  focusedBorderWidth: 1.5,
};

function EditProfileDialog({ profile: p, onSaved, pop }: { profile: User; onSaved: () => void; pop: () => void }) {
  const app = useAppState();
  const { height } = useWindowDimensions();
  const [ctrl, setCtrl] = useState<Record<string, string>>({
    first_name: p.firstName ?? '',
    middle_name: p.middleName ?? '',
    last_name: p.lastName ?? '',
    suffix: p.suffix ?? '',
    email: p.email ?? '',
    phone_number: p.phoneNumber ?? '',
    birthdate: p.birthdate ?? '',
    number_of_children: `${p.numberOfChildren}`,
    date_of_appointment: p.dateOfAppointment ?? '',
    address: p.address ?? '',
    postgraduate_focus: p.education.postgraduateFocus ?? '',
  });
  const [saving, setSaving] = useState(false);
  // DepEd education dropdowns; options come from the server.
  const [eduOptions, setEduOptions] = useState<Record<string, string[]>>({});
  const [edu, setEdu] = useState<Record<string, string | null>>({
    highest_attainment: p.education.highestAttainment,
    undergraduate_degree: p.education.undergraduateDegree,
    specialization: p.education.specialization,
  });
  const [hasCare, setHasCare] = useState(p.hasElderlyOrInfantCare);
  const [overtimeOptIn, setOvertimeOptIn] = useState(p.overtimeOptIn);
  const [skills, setSkills] = useState<string[]>([...p.skills]);
  const [skillOptions, setSkillOptions] = useState<CatalogOption[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    PersonnelService.educationOptions().then((o) => {
      if (mounted.current) setEduOptions(o);
    });
    PersonnelService.skillsMeta().then((r) => {
      if (!mounted.current) return;
      setSkillOptions(
        r.map((m) => ({ name: m.skill_name as string, group: (m.category_name as string | null) ?? null })),
      );
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const setField = (key: string, value: string) => setCtrl((prev) => ({ ...prev, [key]: value }));

  /// Postgraduate focus applies from "With Master's Units" upward (the
  /// attainment options are ordered lowest first).
  const hasPostgrad = (eduOptions.highest_attainment ?? []).indexOf(edu.highest_attainment ?? '') >= 1;

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(ctrl)) {
        if (key !== 'number_of_children' && key !== 'postgraduate_focus' && value.trim().length > 0) {
          body[key] = value.trim();
        }
      }
      const children = parseInt(ctrl.number_of_children.trim(), 10);
      body.number_of_children = isNaN(children) ? 0 : children;
      body.has_elderly_or_infant_care = hasCare;
      body.overtime_opt_in = overtimeOptIn;
      // Always sent so entries can be cleared.
      body.skills = skills;
      body.education = new Education({
        highestAttainment: edu.highest_attainment,
        undergraduateDegree: edu.undergraduate_degree,
        specialization: edu.specialization,
        postgraduateFocus:
          !hasPostgrad || ctrl.postgraduate_focus.trim().length === 0 ? null : ctrl.postgraduate_focus.trim(),
      }).toJson();
      await ApiService.updateMyProfile(body);
      // Re-fetch the current user so the header/sidebar/avatar reflect the new
      // name immediately (they read full_name from AppState.currentUser).
      await app.tryAutoLogin();
      if (mounted.current) {
        pop();
        onSaved();
      }
    } catch (e) {
      if (mounted.current) {
        showSnackBar(`Failed: ${exceptionText(e)}`, { backgroundColor: AppTheme.redColor });
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const pickDate = async (key: string) => {
    const current = tryParseDate(ctrl[key].trim());
    const now = new Date();
    const picked = await showDatePicker({
      initialDate: current ?? (key === 'birthdate' ? new Date(now.getFullYear() - 30, 0, 1) : now),
      firstDate: new Date(1940, 0, 1),
      lastDate: now,
      helpText: key === 'birthdate' ? 'Birthdate' : 'Date of appointment',
      colors: { ...lightPickerColors(AppTheme.accentBlue), surface: '#E8E7EF' },
    });
    if (picked != null) {
      setField(
        key,
        `${picked.getFullYear()}-${`${picked.getMonth() + 1}`.padStart(2, '0')}-${`${picked.getDate()}`.padStart(2, '0')}`,
      );
    }
  };

  const field = (key: string, label: string) => {
    const isDate = DATE_KEYS.has(key);
    return (
      <TextField
        value={ctrl[key]}
        onChangeText={(v) =>
          setField(key, NAME_KEYS.has(key) ? titleCase(v) : key === 'number_of_children' ? digitsOnly(v, 2) : v)
        }
        readOnly={isDate}
        onPress={isDate ? () => pickDate(key) : undefined}
        keyboardType={key === 'number_of_children' ? 'number-pad' : undefined}
        textStyle={tsField({ size: 14, color: AppTheme.textPrimary })}
        decoration={{
          ...fieldDecoration,
          labelText: label,
          suffixIcon: isDate ? <Icon name="calendar_today_outlined" size={16} color={AppTheme.textMuted} /> : undefined,
          focusedBorderColor: AppTheme.accentBlue,
        }}
      />
    );
  };

  const eduDropdown = (key: string, label: string) => {
    const options = eduOptions[key] ?? [];
    const value = edu[key];
    return (
      <DropdownField<string | null>
        isExpanded
        value={value != null && options.includes(value) ? value : null}
        textStyle={tsField({ size: 13, color: AppTheme.textPrimary })}
        decoration={{ ...fieldDecoration, labelText: label }}
        items={[{ value: null, label: '— None —' }, ...options.map((o) => ({ value: o, label: o }))]}
        onChanged={(v) => setEdu((prev) => ({ ...prev, [key]: v }))}
      />
    );
  };

  const row = (children: (React.ReactNode | null)[]) => (
    <View style={{ paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
      {children.map((c, i) => (
        <View key={i} style={{ flex: 1, paddingRight: 8 }}>{c}</View>
      ))}
    </View>
  );

  const toggle = (title: string, subtitle: string, value: boolean, onChanged: (v: boolean) => void) => (
    <View style={{ paddingBottom: 4, paddingRight: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64 + densityDy, paddingVertical: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{title}</Text>
          <Text style={ts({ size: 12, color: '#4B5563' })}>{subtitle}</Text>
        </View>
        <View style={{ width: 16 }} />
        <Switch value={value} onChanged={onChanged} activeColor={AppTheme.accentBlue} />
      </View>
    </View>
  );

  return (
    <Dialog backgroundColor="#FFFFFF" radius={16}>
      <View
        style={{
          width: 820,
          maxWidth: '100%',
          height: height * 0.88,
          maxHeight: '100%',
          paddingLeft: 28,
          paddingTop: 24,
          paddingRight: 28,
          paddingBottom: 20,
        }}
      >
        <Text style={ts({ size: 20, weight: 700, color: AppTheme.textPrimary })}>Edit Profile</Text>
        <View style={{ height: 4 }} />
        <Text style={ts({ size: 13, color: '#4B5563' })}>
          Your education and skills are used to suggest you for matching tasks. Certifications are added by
          uploading the certificate on your profile.
        </Text>
        <View style={{ height: 4 }} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingRight: 6 }}>
          <SectionHeader dense icon="badge_outlined" title="Basic Information" />
          {row([field('first_name', 'First Name'), field('middle_name', 'Middle Name')])}
          {row([field('last_name', 'Last Name'), field('suffix', 'Suffix')])}
          <SectionHeader dense icon="contact_mail_outlined" title="Contact Information" />
          {row([field('email', 'Email'), field('phone_number', 'Phone Number')])}
          {row([field('address', 'Address')])}
          <SectionHeader dense icon="family_restroom_outlined" title="Personal Details" />
          {row([field('birthdate', 'Birthdate'), field('number_of_children', 'Number of Children')])}
          {toggle(
            'I care for an elderly family member or an infant at home',
            'Avoids suggesting you for multi-day, weekend or late-evening tasks.',
            hasCare,
            setHasCare,
          )}
          {toggle(
            'I can take tasks beyond regular school hours',
            'Lets the system suggest you for weekend, after-hours and extracurricular tasks even with family commitments.',
            overtimeOptIn,
            setOvertimeOptIn,
          )}
          <SectionHeader dense icon="work_outline" title="Employment" />
          {row([field('date_of_appointment', 'Date of Appointment')])}
          <SectionHeader dense icon="school_outlined" title="Educational Background" />
          {row([
            eduDropdown('highest_attainment', 'Highest Educational Attainment'),
            eduDropdown('undergraduate_degree', 'Undergraduate Degree'),
          ])}
          {row([
            eduDropdown('specialization', 'Area of Specialization'),
            // Only for "With Master's Units" and higher.
            hasPostgrad ? field('postgraduate_focus', 'Postgraduate Program Focus') : null,
          ])}
          <SectionHeader dense icon="psychology_outlined" title="Skills" />
          {row([
            <CatalogMultiSelect
              key="skills"
              label="Skills"
              selected={skills}
              options={skillOptions}
              onChanged={setSkills}
              decoration={fieldDecoration}
            />,
          ])}
        </ScrollView>
        <View style={{ height: 24, justifyContent: 'center' }}>
          <View style={{ height: 1, backgroundColor: AppTheme.borderColor }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
          <TextButton onPress={pop}>
            <Text style={TextStyles.labelMd}>Cancel</Text>
          </TextButton>
          <View style={{ width: 8 }} />
          <ElevatedButton onPress={saving ? null : save}>
            {saving ? <CircularProgressIndicator size={16} strokeWidth={2} color="#FFFFFF" /> : 'Save'}
          </ElevatedButton>
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  appBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.bgColor,
  },
  card: {
    padding: 28,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 14,
    boxShadow: AppTheme.cardShadow,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EFF4FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0DCEB',
  },
  subjectCard: {
    padding: 16,
    backgroundColor: AppTheme.cardColor,
    borderRadius: 14,
    boxShadow: AppTheme.cardShadow,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  sectionIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#EEF2FA',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
