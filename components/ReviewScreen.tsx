import { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ContactFields } from '../lib/schema';

function Field({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} />
    </View>
  );
}

export function ReviewScreen({
  fields,
  rawText,
  degraded,
  onSave,
  onRescan,
}: {
  fields: ContactFields;
  rawText: string;
  degraded: boolean;
  onSave(edited: ContactFields): Promise<void>;
  onRescan(): void;
}) {
  const [firstName, setFirstName] = useState(fields.firstName ?? '');
  const [lastName, setLastName] = useState(fields.lastName ?? '');
  const [company, setCompany] = useState(fields.company ?? '');
  const [jobTitle, setJobTitle] = useState(fields.jobTitle ?? '');
  const [phones, setPhones] = useState(fields.phones.join(', '));
  const [emails, setEmails] = useState(fields.emails.join(', '));
  const [website, setWebsite] = useState(fields.website ?? '');
  const [address, setAddress] = useState(fields.address ?? '');
  const [saving, setSaving] = useState(false);

  const splitList = (v: string) => v.split(',').map((s) => s.trim()).filter((s) => s !== '');

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        company: company.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        phones: splitList(phones),
        emails: splitList(emails),
        website: website.trim() || undefined,
        address: address.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Check the details</Text>
      {degraded && (
        <Text style={styles.degradedNote}>
          The AI couldn't structure this card — the raw text it read is below. Fill the fields manually.
        </Text>
      )}
      <Field label="First name" value={firstName} onChange={setFirstName} />
      <Field label="Last name" value={lastName} onChange={setLastName} />
      <Field label="Company" value={company} onChange={setCompany} />
      <Field label="Job title" value={jobTitle} onChange={setJobTitle} />
      <Field label="Phones (comma-separated)" value={phones} onChange={setPhones} />
      <Field label="Emails (comma-separated)" value={emails} onChange={setEmails} />
      <Field label="Website" value={website} onChange={setWebsite} />
      <Field label="Address" value={address} onChange={setAddress} />
      <View style={styles.buttons}>
        <Button title="Add to Contacts" onPress={save} disabled={saving} />
        <Button title="Rescan" onPress={onRescan} disabled={saving} />
      </View>
      {rawText !== '' && (
        <View style={styles.rawBlock}>
          <Text style={styles.rawTitle}>Text read from the card</Text>
          <Text style={styles.rawText}>{rawText}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  degradedNote: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, borderRadius: 8, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 16 },
  rawBlock: { backgroundColor: '#f4f4f5', borderRadius: 8, padding: 12 },
  rawTitle: { fontWeight: '600', marginBottom: 6 },
  rawText: { fontFamily: 'Menlo', fontSize: 12, color: '#444' },
});
