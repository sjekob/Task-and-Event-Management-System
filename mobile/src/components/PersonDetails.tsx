import type { ReactNode } from 'react';
import { View } from 'react-native';
import { flag, formatIsoDate, roleLabel, type CertificationInfo, type User } from '@tasknet/shared';
import { Avatar, Card, Pill, Row, SectionHeader, T } from './ui';
import { colors } from '@/theme';

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 7, gap: 16 }}>
      <T v="small">{label}</T>
      <T style={{ flex: 1, textAlign: 'right', fontSize: 14.5 }}>{value || '—'}</T>
    </Row>
  );
}

const CRED_TONE: Record<string, string> = { verified: 'green', submitted: 'amber', rejected: 'red' };

/** Read-only profile sections shared by "My profile" and a personnel record. */
export function PersonDetails({ u, header }: { u: User; header?: ReactNode }) {
  const edu = u.education;
  const certs: CertificationInfo[] = u.certification_details ?? (u.certifications ?? []).map((name) => ({ name }));
  return (
    <>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={u.full_name} size={68} />
        <T v="h2" style={{ textAlign: 'center' }}>{u.full_name}</T>
        <T v="muted">{[roleLabel(u.role), u.grade_level, u.department].filter(Boolean).join(' · ')}</T>
        {u.is_active === 0 || u.is_active === false ? <Pill label="Deactivated" tone="red" /> : null}
        {header}
      </Card>

      <SectionHeader title="Contact & personal" />
      <Card style={{ paddingVertical: 8 }}>
        <Line label="Username" value={u.username} />
        <Line label="Email" value={u.email} />
        <Line label="Phone" value={u.phone_number} />
        <Line label="Address" value={u.address} />
        <Line label="Birthdate" value={u.birthdate ? formatIsoDate(u.birthdate) : null} />
        <Line label="Date of appointment" value={u.date_of_appointment ? formatIsoDate(u.date_of_appointment) : null} />
        <Line label="Children" value={u.number_of_children != null ? String(u.number_of_children) : null} />
        <Line label="Elderly / infant care" value={flag(u.has_elderly_or_infant_care) ? 'Yes' : 'No'} />
        <Line label="Overtime opt-in" value={flag(u.overtime_opt_in) ? 'Yes' : 'No'} />
      </Card>

      {edu && (edu.highest_attainment || edu.undergraduate_degree) ? (
        <>
          <SectionHeader title="Education" />
          <Card style={{ paddingVertical: 8 }}>
            <Line label="Highest attainment" value={edu.highest_attainment} />
            <Line label="Degree" value={edu.undergraduate_degree} />
            <Line label="Specialization" value={edu.specialization} />
            {edu.postgraduate_focus ? <Line label="Postgraduate" value={edu.postgraduate_focus} /> : null}
          </Card>
        </>
      ) : null}

      {!!u.subjects?.length && (
        <>
          <SectionHeader title="Subjects" />
          <Card style={{ gap: 6 }}>
            {u.subjects.map((s, i) => <T key={`${s.subject}-${i}`}>{s.subject}{s.grade_level ? ` · ${s.grade_level}` : ''}</T>)}
          </Card>
        </>
      )}

      {!!(u.skill_details?.length || u.skills?.length) && (
        <>
          <SectionHeader title="Skills" />
          <Card>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {(u.skill_details?.map((s) => s.name) ?? u.skills ?? []).map((s) => <Pill key={s} label={s} tone="blue" />)}
            </Row>
          </Card>
        </>
      )}

      {!!(u.certification_details?.length || u.certifications?.length) && (
        <>
          <SectionHeader title="Certifications" />
          <Card style={{ gap: 10 }}>
            {certs.map((c) => {
              const cred = c.credibility;
              const issuer = c.issuer_acronym || c.issuer;
              return (
                <Row key={c.name} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '600' }}>{c.name}</T>
                    {issuer ? <T v="small">{issuer}</T> : null}
                  </View>
                  {cred && <Pill label={cred === 'submitted' ? 'Awaiting review' : cred} tone={CRED_TONE[cred] ?? 'gray'} />}
                </Row>
              );
            })}
          </Card>
        </>
      )}
      <View style={{ height: 8, backgroundColor: colors.bg }} />
    </>
  );
}
