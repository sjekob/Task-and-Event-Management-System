import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Icon, IconName } from '../components/ui/Icon';
import { ElevatedButton, Tap } from '../components/ui/buttons';
import { DropdownField, InputDecoration, TextField } from '../components/ui/inputs';
import { CircularProgressIndicator } from '../components/ui/misc';
import { showSnackBar } from '../components/ui/overlay';
import { Json } from '../models/models';
import { ApiService, errorMessage } from '../services/apiService';
import { AppTheme, ts, tsField, withOpacity } from '../theme/appTheme';
import { titleCase } from '../utils/inputFormatters';

type ViewState = 'loading' | 'locked' | 'error' | 'form' | 'submitted';

const ROLE_OPTIONS = ['student', 'teacher', 'parent', 'visitor', 'dean', 'coordinator', 'principal', 'registrar'];
// Fallbacks; the server sends the authoritative lists with the event.
const SEX_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const AGE_GROUPS = ['17 and below', '18-24', '25-34', '35-44', '45-54', '55 and above'];

const RED = '#F44336';

interface Indicator {
  label: string;
  evident: boolean | null;
}

const validEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

const decor = (hint: string): InputDecoration => ({
  labelText: hint,
  filled: true,
  fillColor: '#F9FAFB',
});

const fieldText = tsField({ size: 13 });

function StatusPanel({ icon, color, title, body }: { icon: IconName; color: string; title: string; body: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Icon name={icon} size={56} color={color} />
      <View style={{ height: 16 }} />
      <Text style={ts({ size: 20, weight: 700, color: AppTheme.textPrimary, align: 'center' })}>{title}</Text>
      <View style={{ height: 8 }} />
      <Text style={ts({ size: 13, color: AppTheme.textMuted, align: 'center' })}>{body}</Text>
    </View>
  );
}

/// Reached by scanning an event's QR code — no login involved. This is a DepEd
/// "Observation Tool": the indicators come from the last section of the event's
/// own proposal (served by the backend). Each indicator is marked Evident /
/// Not Evident with optional remarks. No scoring happens here — the backend
/// decides everything (which indicators, whether the form is open, the score).
export default function PublicEvaluationScreen({ eventId }: { eventId: string }) {
  const [state, setState] = useState<ViewState>('loading');
  const [message, setMessage] = useState('');
  const [event, setEvent] = useState<Json | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [comments, setComments] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [role, setRole] = useState('student');
  const [sex, setSex] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      setState('loading');
      try {
        const loaded = await ApiService.getPublicEvent(eventId);
        if (!mounted.current) return;
        const rawIndicators = (loaded.indicators as unknown[] | null) ?? [];
        setEvent(loaded);
        if (loaded.is_open === true) {
          setIndicators(rawIndicators.map((e) => ({ label: String(e), evident: null })));
          setState('form');
        } else {
          setMessage((loaded.lock_reason as string | null) ?? 'This event is not open for evaluation yet.');
          setState('locked');
        }
      } catch (e) {
        if (!mounted.current) return;
        setMessage(errorMessage(e));
        setState('error');
      }
    })();
    return () => {
      mounted.current = false;
    };
  }, [eventId]);

  const options = (key: string, fallback: string[]): string[] => {
    const opts = event?.demographic_options?.[key];
    return Array.isArray(opts) ? opts.map((e) => String(e)) : fallback;
  };

  const submit = async () => {
    if (!validEmail(email.trim())) {
      showSnackBar('Please enter a valid email address.', { backgroundColor: RED });
      return;
    }
    if (sex == null || ageGroup == null) {
      showSnackBar('Please select your sex and age group.', { backgroundColor: RED });
      return;
    }
    if (!indicators.every((i) => i.evident != null)) {
      showSnackBar('Please mark every indicator as Evident or Not Evident.', { backgroundColor: RED });
      return;
    }
    setSubmitting(true);
    try {
      await ApiService.submitPublicEvaluation(eventId, {
        evaluator_name: name.trim().length === 0 ? null : name.trim(),
        evaluator_email: email.trim(),
        evaluator_role: role,
        sex,
        age_group: ageGroup,
        affiliation: affiliation.trim().length === 0 ? null : affiliation.trim(),
        indicators: indicators.map((i) => ({ label: i.label, evident: i.evident })),
        comments: comments.trim().length === 0 ? null : comments.trim(),
      });
      if (mounted.current) setState('submitted');
    } catch (e) {
      if (mounted.current) showSnackBar(errorMessage(e), { backgroundColor: RED });
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const evidentChip = (idx: number, value: boolean, label: string, color: string) => {
    const selected = indicators[idx].evident === value;
    return (
      <Tap
        style={{ flex: 1 }}
        onPress={() => setIndicators((prev) => prev.map((ind, i) => (i === idx ? { ...ind, evident: value } : ind)))}
      >
        <View
          style={{
            paddingVertical: 8,
            backgroundColor: selected ? withOpacity(color, 0.12) : '#FFFFFF',
            borderRadius: 8,
            borderWidth: selected ? 1.4 : 0.8,
            borderColor: selected ? color : '#CBD5E1',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={value ? 'check_circle' : 'cancel'} size={15} color={selected ? color : '#94A3B8'} />
          <View style={{ width: 6 }} />
          <Text style={ts({ size: 12, weight: 600, color: selected ? color : AppTheme.textMuted })}>{label}</Text>
        </View>
      </Tap>
    );
  };

  const dropdown = (
    value: string | null,
    label: string,
    items: string[],
    onChanged: (v: string) => void,
    display: (v: string) => string = (v) => v,
    isExpanded = true,
  ) => (
    <View style={{ flex: 1 }}>
      <DropdownField<string>
        value={value}
        isExpanded={isExpanded}
        decoration={decor(label)}
        textStyle={tsField({ size: 13, color: AppTheme.textPrimary })}
        items={items.map((o) => ({ value: o, label: display(o) }))}
        onChanged={onChanged}
      />
    </View>
  );

  const form = () => {
    const e = event as Json;
    const monitoring = (e.monitoring_criteria as string | null)?.trim();
    const details = [
      (e.target_date as string | null)?.length ? `Date: ${e.target_date}` : null,
      (e.organizer_name as string | null)?.length ? `Organizer: ${e.organizer_name}` : null,
      (e.venue as string | null)?.length ? `Venue: ${e.venue}` : null,
    ].filter((s) => s != null);
    return (
      <View>
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F2C59', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="account_balance" color="#FFFFFF" size={24} />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={ts({ size: 15, weight: 800, color: '#0F172A' })}>Kagawaran ng Edukasyon</Text>
            <Text style={ts({ size: 11, color: '#475569' })}>Performance Observation Tool</Text>
          </View>
        </View>
        <View style={{ height: 12 }} />
        <View style={{ height: 2, backgroundColor: '#0F172A' }} />
        <View style={{ height: 16 }} />

        {/* ── Event details ── */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: '#F8FAFC',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'flex-start',
          }}
        >
          <Text style={ts({ size: 16, weight: 700, color: '#0F172A' })}>{(e.title as string | null) ?? 'Event Evaluation'}</Text>
          <View style={{ height: 4 }} />
          <Text style={ts({ size: 12, color: '#475569' })}>{details.join('  ·  ')}</Text>
        </View>
        {monitoring != null && monitoring.length > 0 && (
          <>
            <View style={{ height: 12 }} />
            <Text style={ts({ size: 12, weight: 700, color: AppTheme.textPrimary })}>Monitoring & Evaluation Criteria</Text>
            <View style={{ height: 4 }} />
            <Text style={ts({ size: 12, color: AppTheme.textMuted })}>{monitoring}</Text>
          </>
        )}
        <View style={{ height: 20 }} />

        {/* ── Name & role ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextField
            style={{ flex: 1 }}
            value={name}
            onChangeText={(v) => setName(titleCase(v))}
            autoCapitalize="words"
            decoration={decor('Name (optional)')}
            textStyle={fieldText}
          />
          <View style={{ width: 12 }} />
          {dropdown(role, 'I am a...', ROLE_OPTIONS, setRole, (r) => r[0].toUpperCase() + r.substring(1), false)}
        </View>
        <View style={{ height: 12 }} />
        {/* ── Email (required — one evaluation per email per event) ── */}
        <TextField
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          decoration={{ ...decor('Email (required)'), helperText: 'Each email can submit this evaluation only once.' }}
          textStyle={fieldText}
        />
        <View style={{ height: 16 }} />

        {/* ── Demographics (for the event's evaluation report) ── */}
        <Text style={ts({ size: 14, weight: 800, color: AppTheme.textPrimary })}>About you</Text>
        <View style={{ height: 4 }} />
        <Text style={ts({ size: 12, color: AppTheme.textMuted })}>Used only to summarize who evaluated the event.</Text>
        <View style={{ height: 10 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {dropdown(sex, 'Sex (required)', options('sex', SEX_OPTIONS), setSex)}
          <View style={{ width: 12 }} />
          {dropdown(ageGroup, 'Age group (required)', options('age_group', AGE_GROUPS), setAgeGroup)}
        </View>
        <View style={{ height: 12 }} />
        <TextField
          value={affiliation}
          onChangeText={setAffiliation}
          decoration={decor('School / office / organization (optional)')}
          textStyle={fieldText}
        />
        <View style={{ height: 20 }} />

        {/* ── Indicators (the proposal's last section) ── */}
        <Text style={ts({ size: 14, weight: 800, color: AppTheme.textPrimary })}>Observation Indicators</Text>
        <View style={{ height: 4 }} />
        <Text style={ts({ size: 12, color: AppTheme.textMuted })}>
          Mark each indicator as Evident or Not Evident based on what you observed.
        </Text>
        <View style={{ height: 12 }} />
        {indicators.map((ind, idx) => (
          <View
            key={idx}
            style={{
              marginBottom: 10,
              padding: 12,
              backgroundColor: '#FAFBFC',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text style={ts({ size: 13, weight: 600, color: AppTheme.textPrimary })}>{`${idx + 1}. ${ind.label}`}</Text>
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {evidentChip(idx, true, 'Evident', AppTheme.greenColor)}
              <View style={{ width: 8 }} />
              {evidentChip(idx, false, 'Not Evident', AppTheme.redColor)}
            </View>
          </View>
        ))}
        <View style={{ height: 8 }} />

        {/* ── Comments ── */}
        <TextField
          value={comments}
          onChangeText={setComments}
          maxLines={3}
          minLines={3}
          decoration={decor('Overall comments (optional)')}
          textStyle={fieldText}
        />
        <View style={{ height: 20 }} />
        <ElevatedButton
          onPress={submitting ? null : submit}
          backgroundColor="#0F2C59"
          foregroundColor="#FFFFFF"
          padding={[0, 14]}
        >
          {submitting ? <CircularProgressIndicator size={18} strokeWidth={2} color="#FFFFFF" /> : 'Submit Evaluation'}
        </ElevatedButton>
      </View>
    );
  };

  const body = () => {
    switch (state) {
      case 'loading':
        return (
          <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgressIndicator />
          </View>
        );
      case 'error':
        return <StatusPanel icon="error_outline" color={AppTheme.redColor} title="Unable to load event" body={message} />;
      case 'locked':
        return (
          <StatusPanel
            icon="lock_outline"
            color={AppTheme.amberColor}
            title={(event?.title as string | null) ?? 'Event Evaluation'}
            body={message}
          />
        );
      case 'submitted':
        return (
          <StatusPanel
            icon="check_circle_outline"
            color={AppTheme.greenColor}
            title="Evaluation Submitted!"
            body="Thank you for your response. Your feedback helps improve our future events."
          />
        );
      case 'form':
        return form();
    }
  };

  // The status panels size the card to their text; the form and the loader fill it.
  const fills = state === 'form' || state === 'loading';
  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 24,
        }}
      >
        <View
          style={{
            width: fills ? '100%' : undefined,
            maxWidth: 720,
            padding: 24,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            boxShadow: '0px 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          {body()}
        </View>
      </ScrollView>
    </View>
  );
}
