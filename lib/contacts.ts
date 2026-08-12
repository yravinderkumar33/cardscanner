import * as Contacts from 'expo-contacts';
import { ContactFields } from './schema';
import { toExpoContact } from './contactMapping';

export type SaveResult = 'presented' | 'denied';

/**
 * Presents the system "New Contact" form, prefilled. iOS writes the contact
 * only if the user taps Done there, and never reports back which button they
 * chose — so the result says the form was presented, not that it was saved.
 *
 * Deliberately does NOT request Contacts permission: CNContactViewController's
 * new-contact form is user-mediated, so it needs no authorization (verified in
 * expo-contacts' ContactsModule.swift, which performs no permission check).
 * Asking would trigger iOS's "share all contacts" prompt for read access this
 * app never wants — and would make "never reads your address book" untrue.
 */
export async function saveToContacts(fields: ContactFields): Promise<SaveResult> {
  await Contacts.presentFormAsync(null, toExpoContact(fields) as Contacts.Contact, {
    isNew: true,
  });
  return 'presented';
}
