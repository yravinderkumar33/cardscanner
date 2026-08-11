import * as Contacts from 'expo-contacts';
import { ContactFields } from './schema';
import { toExpoContact } from './contactMapping';

export async function saveToContacts(fields: ContactFields): Promise<'saved' | 'denied'> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return 'denied';
  // Native prefilled "New Contact" form; the user taps Save/Cancel there.
  await Contacts.presentFormAsync(null, toExpoContact(fields) as Contacts.Contact, { isNew: true });
  return 'saved';
}
