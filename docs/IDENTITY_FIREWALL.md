# Identity Firewall

The **Identity Firewall** is FreeLayer's boundary between *who a member is* (identity, verification, contact linkage) and *what a local relationship or environment signal is allowed to imply*. Real identity — verification ceremonies, invites, key material, recovery — is **Gate G** design work and is not implemented; member/device references are local, unverified placeholders. This document records the invariants other subsystems must respect so that no non-identity signal is ever mistaken for identity.

## Device posture is not identity (TECH-23)

Device posture is an **environment attribute**, strictly separate from identity (Gate G) and authority. A posture assessment never proves who a member is, never grants membership or capabilities, and never substitutes for a `PolicyDecision`. FreeLayer is the RATS Relying Party only; the external Verifier is not an identity provider. Posture and identity are independent authorization inputs (NIST SP 800-207). A membership relationship (TECH-20) is likewise local and unverified — neither posture nor membership asserts a verified identity.
