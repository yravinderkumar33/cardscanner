import { toExpoContact } from '../contactMapping';

describe('toExpoContact', () => {
  it('maps all fields with work labels', () => {
    const c = toExpoContact({
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phones: ['+91 98765', '020 123'], emails: ['jane@acme.com'],
      website: 'https://acme.com', address: '1 Main St',
    });
    expect(c).toEqual({
      contactType: 'person',
      firstName: 'Jane', lastName: 'Doe', company: 'Acme', jobTitle: 'CTO',
      phoneNumbers: [{ number: '+91 98765', label: 'work' }, { number: '020 123', label: 'work' }],
      emails: [{ email: 'jane@acme.com', label: 'work' }],
      urlAddresses: [{ url: 'https://acme.com', label: 'work' }],
      addresses: [{ street: '1 Main St', label: 'work' }],
    });
  });

  it('omits empty arrays and undefined fields entirely', () => {
    const c = toExpoContact({ firstName: 'Jane', phones: [], emails: [] });
    expect(c).toEqual({ contactType: 'person', firstName: 'Jane' });
    expect(c).not.toHaveProperty('phoneNumbers');
    expect(c).not.toHaveProperty('emails');
  });
});
