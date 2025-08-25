import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const simnet = (globalThis as any).simnet;

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

const contractName = "passport-system";

// Test data
const testPassportId = "PP12345678";
const testFullName = "John Doe";
const testDateOfBirth = 315532800; // January 1, 1980 in seconds
const testNationality = "USA";
const testValidityPeriod = 315360000; // ~10 years in blocks
const testMetadataUrl = "https://example.com/passport-metadata";
const testAuthorityName = "US Passport Agency";

describe("Digital Passport System Tests", () => {
  beforeEach(() => {
    simnet.mineEmptyBlocks(1);
  });

  describe("Read-Only Functions", () => {
    it("get-passport returns none for non-existent passport", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-passport", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      expect(result).toBeNone();
    });

    it("get-holder-passport returns none for holder without passport", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-passport", [
        Cl.principal(address1)
      ], deployer);
      expect(result).toBeNone();
    });

    it("is-valid-passport? returns false for non-existent passport", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      expect(result).toBeBool(false);
    });

    it("is-authority returns false for non-authority", () => {
      const { result } = simnet.callReadOnlyFn(contractName, "is-authority", [
        Cl.principal(address1)
      ], deployer);
      expect(result).toBeBool(false);
    });
  });

  describe("Add Authority Function", () => {
    it("add-authority allows owner to add authority", () => {
      const { result } = simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("add-authority updates authority status correctly", () => {
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "is-authority", [
        Cl.principal(address1)
      ], deployer);
      expect(result).toBeBool(true);
    });

    it("add-authority prevents non-owner from adding authority", () => {
      const { result } = simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("add-authority prevents duplicate authority registration", () => {
      // First registration
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);

      // Second registration attempt
      const { result } = simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8("Another Authority")
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(3)); // err-already-exists
    });
  });

  describe("Remove Authority Function", () => {
    beforeEach(() => {
      // Setup: Add authority first
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
    });

    it("remove-authority allows owner to remove authority", () => {
      const { result } = simnet.callPublicFn(contractName, "remove-authority", [
        Cl.principal(address1)
      ], deployer);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("remove-authority updates authority status correctly", () => {
      simnet.callPublicFn(contractName, "remove-authority", [Cl.principal(address1)], deployer);

      const { result } = simnet.callReadOnlyFn(contractName, "is-authority", [
        Cl.principal(address1)
      ], deployer);
      expect(result).toBeBool(false);
    });

    it("remove-authority prevents non-owner from removing authority", () => {
      const { result } = simnet.callPublicFn(contractName, "remove-authority", [
        Cl.principal(address1)
      ], address2);
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("remove-authority prevents removing non-existent authority", () => {
      const { result } = simnet.callPublicFn(contractName, "remove-authority", [
        Cl.principal(address3) // Not an authority
      ], deployer);
      
      expect(result).toBeErr(Cl.uint(4)); // err-not-found
    });
  });

  describe("Issue Passport Function", () => {
    beforeEach(() => {
      // Setup: Add authority
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
    });

    it("issue-passport allows authority to issue passport", () => {
      const { result } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("issue-passport stores passport information correctly", () => {
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-passport", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          "full-name": Cl.stringUtf8(testFullName),
          "date-of-birth": Cl.uint(testDateOfBirth),
          nationality: Cl.stringUtf8(testNationality),
          "issue-date": Cl.uint(simnet.blockHeight),
          "expiry-date": Cl.uint(simnet.blockHeight + testValidityPeriod),
          "is-valid": Cl.bool(true),
          "metadata-url": Cl.some(Cl.stringUtf8(testMetadataUrl)),
        })
      );
    });

    it("issue-passport creates holder passport mapping", () => {
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-holder-passport", [
        Cl.principal(address2)
      ], deployer);
      
      expect(result).toBeSome(Cl.stringUtf8(testPassportId));
    });

    it("issue-passport makes passport valid", () => {
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeBool(true);
    });

    it("issue-passport prevents non-authority from issuing", () => {
      const { result } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address2); // address2 is not an authority
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("issue-passport prevents duplicate passport ID", () => {
      // First passport
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);

      // Second passport with same ID
      const { result } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId), // Same passport ID
        Cl.principal(address3),
        Cl.stringUtf8("Jane Doe"),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.none()
      ], address1);
      
      expect(result).toBeErr(Cl.uint(3)); // err-already-exists
    });

    it("issue-passport prevents multiple passports for same holder", () => {
      // First passport
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);

      // Second passport for same holder
      const { result } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8("PP87654321"), // Different passport ID
        Cl.principal(address2), // Same holder
        Cl.stringUtf8("John Doe Updated"),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.none()
      ], address1);
      
      expect(result).toBeErr(Cl.uint(3)); // err-already-exists
    });

    it("issue-passport allows passport without metadata URL", () => {
      const { result } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.none() // No metadata URL
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });
  });

  describe("Revoke Passport Function", () => {
    beforeEach(() => {
      // Setup: Add authority and issue passport
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);
    });

    it("revoke-passport allows authority to revoke passport", () => {
      const { result } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("revoke-passport updates passport validity status", () => {
      simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-passport", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          "full-name": Cl.stringUtf8(testFullName),
          "date-of-birth": Cl.uint(testDateOfBirth),
          nationality: Cl.stringUtf8(testNationality),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(expect.any(Number)),
          "is-valid": Cl.bool(false), // Should be false after revocation
          "metadata-url": Cl.some(Cl.stringUtf8(testMetadataUrl)),
        })
      );
    });

    it("revoke-passport makes passport invalid", () => {
      simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeBool(false);
    });

    it("revoke-passport prevents non-authority from revoking", () => {
      const { result } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address2); // address2 is not an authority
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("revoke-passport prevents revoking non-existent passport", () => {
      const { result } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8("NONEXISTENT")
      ], address1);
      
      expect(result).toBeErr(Cl.uint(4)); // err-not-found
    });
  });

  describe("Update Passport Metadata Function", () => {
    beforeEach(() => {
      // Setup: Add authority and issue passport
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);
    });

    it("update-passport-metadata allows authority to update metadata", () => {
      const newMetadataUrl = "https://example.com/updated-metadata";
      const { result } = simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8(testPassportId),
        Cl.some(Cl.stringUtf8(newMetadataUrl))
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("update-passport-metadata updates metadata URL correctly", () => {
      const newMetadataUrl = "https://example.com/updated-metadata";
      simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8(testPassportId),
        Cl.some(Cl.stringUtf8(newMetadataUrl))
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-passport", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          "full-name": Cl.stringUtf8(testFullName),
          "date-of-birth": Cl.uint(testDateOfBirth),
          nationality: Cl.stringUtf8(testNationality),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(expect.any(Number)),
          "is-valid": Cl.bool(true),
          "metadata-url": Cl.some(Cl.stringUtf8(newMetadataUrl)), // Updated URL
        })
      );
    });

    it("update-passport-metadata allows setting metadata to none", () => {
      const { result } = simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8(testPassportId),
        Cl.none() // Remove metadata URL
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("update-passport-metadata prevents non-authority from updating", () => {
      const { result } = simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8(testPassportId),
        Cl.some(Cl.stringUtf8("https://example.com/unauthorized"))
      ], address2); // address2 is not an authority
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("update-passport-metadata prevents updating non-existent passport", () => {
      const { result } = simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8("NONEXISTENT"),
        Cl.some(Cl.stringUtf8("https://example.com/metadata"))
      ], address1);
      
      expect(result).toBeErr(Cl.uint(4)); // err-not-found
    });
  });

  describe("Extend Passport Validity Function", () => {
    beforeEach(() => {
      // Setup: Add authority and issue passport
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);
    });

    it("extend-passport-validity allows authority to extend validity", () => {
      const extensionPeriod = 157680000; // ~5 years in blocks
      const { result } = simnet.callPublicFn(contractName, "extend-passport-validity", [
        Cl.stringUtf8(testPassportId),
        Cl.uint(extensionPeriod)
      ], address1);
      
      expect(result).toBeOk(Cl.bool(true));
    });

    it("extend-passport-validity updates expiry date correctly", () => {
      const extensionPeriod = 157680000;
      const originalExpiryDate = simnet.blockHeight + testValidityPeriod;
      
      simnet.callPublicFn(contractName, "extend-passport-validity", [
        Cl.stringUtf8(testPassportId),
        Cl.uint(extensionPeriod)
      ], address1);

      const { result } = simnet.callReadOnlyFn(contractName, "get-passport", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      
      expect(result).toBeSome(
        Cl.tuple({
          holder: Cl.principal(address2),
          "full-name": Cl.stringUtf8(testFullName),
          "date-of-birth": Cl.uint(testDateOfBirth),
          nationality: Cl.stringUtf8(testNationality),
          "issue-date": Cl.uint(expect.any(Number)),
          "expiry-date": Cl.uint(originalExpiryDate + extensionPeriod), // Extended date
          "is-valid": Cl.bool(true),
          "metadata-url": Cl.some(Cl.stringUtf8(testMetadataUrl)),
        })
      );
    });

    it("extend-passport-validity prevents non-authority from extending", () => {
      const { result } = simnet.callPublicFn(contractName, "extend-passport-validity", [
        Cl.stringUtf8(testPassportId),
        Cl.uint(157680000)
      ], address2); // address2 is not an authority
      
      expect(result).toBeErr(Cl.uint(1)); // err-unauthorized
    });

    it("extend-passport-validity prevents extending non-existent passport", () => {
      const { result } = simnet.callPublicFn(contractName, "extend-passport-validity", [
        Cl.stringUtf8("NONEXISTENT"),
        Cl.uint(157680000)
      ], address1);
      
      expect(result).toBeErr(Cl.uint(4)); // err-not-found
    });
  });

  describe("Integration Tests", () => {
    it("handles complete passport lifecycle", () => {
      // 1. Add authority
      const { result: addAuthorityResult } = simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);
      expect(addAuthorityResult).toBeOk(Cl.bool(true));

      // 2. Issue passport
      const { result: issueResult } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8(testMetadataUrl))
      ], address1);
      expect(issueResult).toBeOk(Cl.bool(true));

      // 3. Verify passport is valid
      const { result: validResult } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      expect(validResult).toBeBool(true);

      // 4. Update metadata
      const newMetadataUrl = "https://example.com/updated";
      const { result: updateResult } = simnet.callPublicFn(contractName, "update-passport-metadata", [
        Cl.stringUtf8(testPassportId),
        Cl.some(Cl.stringUtf8(newMetadataUrl))
      ], address1);
      expect(updateResult).toBeOk(Cl.bool(true));

      // 5. Extend validity
      const { result: extendResult } = simnet.callPublicFn(contractName, "extend-passport-validity", [
        Cl.stringUtf8(testPassportId),
        Cl.uint(157680000)
      ], address1);
      expect(extendResult).toBeOk(Cl.bool(true));

      // 6. Revoke passport
      const { result: revokeResult } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);
      expect(revokeResult).toBeOk(Cl.bool(true));

      // 7. Verify passport is no longer valid
      const { result: finalValidResult } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8(testPassportId)
      ], deployer);
      expect(finalValidResult).toBeBool(false);
    });

    it("handles multiple authorities and passports", () => {
      // Add multiple authorities
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8("Authority 1")
      ], deployer);
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address2),
        Cl.stringUtf8("Authority 2")
      ], deployer);

      // Each authority issues a passport
      const { result: passport1 } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8("PP11111111"),
        Cl.principal(address3),
        Cl.stringUtf8("Person One"),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8("USA"),
        Cl.uint(testValidityPeriod),
        Cl.none()
      ], address1);
      expect(passport1).toBeOk(Cl.bool(true));

      const { result: passport2 } = simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8("PP22222222"),
        Cl.principal(deployer),
        Cl.stringUtf8("Person Two"),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8("Canada"),
        Cl.uint(testValidityPeriod),
        Cl.some(Cl.stringUtf8("https://example.com/person2"))
      ], address2);
      expect(passport2).toBeOk(Cl.bool(true));

      // Verify both passports are valid
      const { result: valid1 } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8("PP11111111")
      ], deployer);
      expect(valid1).toBeBool(true);

      const { result: valid2 } = simnet.callReadOnlyFn(contractName, "is-valid-passport?", [
        Cl.stringUtf8("PP22222222")
      ], deployer);
      expect(valid2).toBeBool(true);
    });

    it("handles authority deactivation and reactivation", () => {
      // Add authority
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);

      // Issue passport
      simnet.callPublicFn(contractName, "issue-passport", [
        Cl.stringUtf8(testPassportId),
        Cl.principal(address2),
        Cl.stringUtf8(testFullName),
        Cl.uint(testDateOfBirth),
        Cl.stringUtf8(testNationality),
        Cl.uint(testValidityPeriod),
        Cl.none()
      ], address1);

      // Remove authority
      simnet.callPublicFn(contractName, "remove-authority", [
        Cl.principal(address1)
      ], deployer);

      // Try to revoke passport as removed authority (should fail)
      const { result: revokeAttempt } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);
      expect(revokeAttempt).toBeErr(Cl.uint(1)); // err-unauthorized

      // Re-add authority
      simnet.callPublicFn(contractName, "add-authority", [
        Cl.principal(address1),
        Cl.stringUtf8(testAuthorityName)
      ], deployer);

      // Now revoke should work
      const { result: revokeSuccess } = simnet.callPublicFn(contractName, "revoke-passport", [
        Cl.stringUtf8(testPassportId)
      ], address1);
      expect(revokeSuccess).toBeOk(Cl.bool(true));
    });
  });
});