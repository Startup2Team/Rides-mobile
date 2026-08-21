import {
  emptyVehicleDocumentSet,
  isDocumentReplaceable,
  resolveVehicleDocuments,
} from '@/domain/driverVehicleDocuments';
import type { DriverDocument } from '@/services/driverDocuments';
import type { DriverVehicleDocumentSet } from '@/types';

const AT = '2026-08-09T10:00:00.000Z';

function serverDoc(documentType: string, fileUrl: string, overrides: Partial<DriverDocument> = {}): DriverDocument {
  return {
    id: `${documentType}-id`,
    documentType,
    fileUrl,
    reviewStatus: 'APPROVED',
    editable: false,
    ...overrides,
  };
}

function localSet(overrides: Partial<DriverVehicleDocumentSet> = {}): DriverVehicleDocumentSet {
  return { ...emptyVehicleDocumentSet(AT), ...overrides };
}

describe('emptyVehicleDocumentSet', () => {
  it('returns every card, so a picked photo has a record to be written into', () => {
    const set = emptyVehicleDocumentSet(AT);
    expect(Object.keys(set).sort()).toEqual(['authorization', 'insurance', 'license', 'nationalId']);
    for (const key of Object.keys(set) as (keyof DriverVehicleDocumentSet)[]) {
      expect(set[key].key).toBe(key);
      expect(set[key].faces).toEqual([null, null]);
    }
  });
});

describe('resolveVehicleDocuments', () => {
  it('never returns null, so the screen can always accept a replacement photo', () => {
    // The bug: a vehicle with no locally held documents produced a null draft,
    // and the code storing a newly taken photo bailed out on null — the picker
    // returned, nothing appeared in the preview, and no error was shown.
    const resolved = resolveVehicleDocuments(undefined, [], AT);
    expect(resolved).toEqual(emptyVehicleDocumentSet(AT));

    const noDocs = resolveVehicleDocuments({ documents: undefined, pendingDocumentUpdate: null } as never, [], AT);
    expect(noDocs.license.faces).toEqual([null, null]);
  });

  it('shows the server documents when this handset holds none', () => {
    // The second phone / post-reinstall case: cards read "Missing" while the
    // Verification documents list on the same screen showed them APPROVED.
    const resolved = resolveVehicleDocuments(
      { documents: undefined, pendingDocumentUpdate: null } as never,
      [
        serverDoc('LICENCE_FRONT', 'https://cdn/licence-front.jpg'),
        serverDoc('LICENCE_BACK', 'https://cdn/licence-back.jpg'),
        serverDoc('VEHICLE_INSURANCE', 'https://cdn/insurance.jpg'),
      ],
      AT,
    );

    expect(resolved.license.faces).toEqual(['https://cdn/licence-front.jpg', 'https://cdn/licence-back.jpg']);
    expect(resolved.license.reviewStatus).toBe('verified');
    expect(resolved.insurance.faces[0]).toBe('https://cdn/insurance.jpg');
    // Nothing on the server for this one — it stays genuinely empty.
    expect(resolved.authorization.faces).toEqual([null, null]);
  });

  it('lets the server fill only the faces the handset is missing', () => {
    const local = localSet({
      license: { ...emptyVehicleDocumentSet(AT).license, faces: ['file:///local-front.jpg', null] },
    });

    const resolved = resolveVehicleDocuments({ documents: local, pendingDocumentUpdate: null } as never, [
      serverDoc('LICENCE_BACK', 'https://cdn/licence-back.jpg'),
    ]);

    expect(resolved.license.faces).toEqual(['file:///local-front.jpg', 'https://cdn/licence-back.jpg']);
  });

  it('prefers a pending document update over the stored set', () => {
    // A pending update is the driver's most recent submission and is what
    // review is currently looking at.
    const stored = localSet({
      license: { ...emptyVehicleDocumentSet(AT).license, faces: ['file:///old.jpg', null] },
    });
    const pending = localSet({
      license: { ...emptyVehicleDocumentSet(AT).license, faces: ['file:///new.jpg', null] },
    });

    const resolved = resolveVehicleDocuments(
      { documents: stored, pendingDocumentUpdate: { documents: pending } } as never,
      [],
    );

    expect(resolved.license.faces[0]).toBe('file:///new.jpg');
  });

  it('returns the local set untouched when the server has nothing', () => {
    const local = localSet();
    expect(resolveVehicleDocuments({ documents: local, pendingDocumentUpdate: null } as never, [])).toBe(local);
  });

  it('carries the server review status onto the card', () => {
    const resolved = resolveVehicleDocuments({ documents: localSet(), pendingDocumentUpdate: null } as never, [
      serverDoc('NATIONAL_ID_FRONT', 'https://cdn/id.jpg', { reviewStatus: 'REJECTED', editable: true }),
    ]);

    expect(resolved.nationalId.reviewStatus).toBe('rejected');
    expect(resolved.nationalId.faces[0]).toBe('https://cdn/id.jpg');
  });

  it('carries the server editable flag onto the card so re-upload can be gated on it', () => {
    const resolved = resolveVehicleDocuments({ documents: localSet(), pendingDocumentUpdate: null } as never, [
      // Locked (view-only) front, admin-opened window on the national id.
      serverDoc('LICENCE_FRONT', 'https://cdn/licence.jpg', { reviewStatus: 'APPROVED', editable: false }),
      serverDoc('NATIONAL_ID_FRONT', 'https://cdn/id.jpg', { reviewStatus: 'REJECTED', editable: true }),
    ]);

    expect(resolved.license.editable).toBe(false);
    expect(resolved.nationalId.editable).toBe(true);
  });
});

describe('isDocumentReplaceable', () => {
  it('trusts an explicit server signal over the vehicle-status fallback', () => {
    // Admin opened a re-upload window on a not-yet-approved vehicle.
    expect(isDocumentReplaceable(true, false)).toBe(true);
    // Approved document the server has locked — no Replace even on an approved
    // vehicle (this is the silent-409 the change removes).
    expect(isDocumentReplaceable(false, true)).toBe(false);
  });

  it('falls back to the vehicle-status rule when the server said nothing', () => {
    // Older server / offline: preserve the prior behaviour.
    expect(isDocumentReplaceable(undefined, true)).toBe(true);
    expect(isDocumentReplaceable(undefined, false)).toBe(false);
  });
});
