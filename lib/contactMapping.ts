import { ContactFields } from './schema';

// Shape accepted by expo-contacts' presentFormAsync contact argument.
// Typed locally so lib/ has no expo import; 'person' === Contacts.ContactTypes.Person.
export interface ExpoContactShape {
  contactType: 'person';
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phoneNumbers?: { number: string; label: string }[];
  emails?: { email: string; label: string }[];
  urlAddresses?: { url: string; label: string }[];
  addresses?: { street: string; label: string }[];
}

export function toExpoContact(fields: ContactFields): ExpoContactShape {
  const contact: ExpoContactShape = { contactType: 'person' };
  if (fields.firstName) contact.firstName = fields.firstName;
  if (fields.lastName) contact.lastName = fields.lastName;
  if (fields.company) contact.company = fields.company;
  if (fields.jobTitle) contact.jobTitle = fields.jobTitle;
  if (fields.phones.length > 0) {
    contact.phoneNumbers = fields.phones.map((number) => ({ number, label: 'work' }));
  }
  if (fields.emails.length > 0) {
    contact.emails = fields.emails.map((email) => ({ email, label: 'work' }));
  }
  if (fields.website) contact.urlAddresses = [{ url: fields.website, label: 'work' }];
  if (fields.address) contact.addresses = [{ street: fields.address, label: 'work' }];
  return contact;
}
