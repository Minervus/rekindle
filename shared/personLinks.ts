// Relationship types for links between two people. Each has an inverse, so
// one stored row serves both profiles: the row records the link from
// `personId`'s point of view, and the other person's profile renders
// LINK_TYPE_INVERSE[type] instead. Storing a single row means the two sides
// can never drift out of sync the way mirrored rows would.
export const LINK_TYPES = [
  "spouse",
  "partner",
  "parent",
  "child",
  "sibling",
  "relative",
  "friend",
  "colleague",
  "referred_by",
  "referred",
  "other",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  spouse: "Spouse",
  partner: "Partner",
  parent: "Parent",
  child: "Child",
  sibling: "Sibling",
  relative: "Relative",
  friend: "Friend",
  colleague: "Colleague",
  referred_by: "Referred by",
  referred: "Referred",
  other: "Connected to",
};

// Symmetric types are their own inverse; the asymmetric pairs point at each
// other. "A is B's parent" has to read as "B is A's child" from the other
// side, or the link is actively misleading.
export const LINK_TYPE_INVERSE: Record<LinkType, LinkType> = {
  spouse: "spouse",
  partner: "partner",
  parent: "child",
  child: "parent",
  sibling: "sibling",
  relative: "relative",
  friend: "friend",
  colleague: "colleague",
  referred_by: "referred",
  referred: "referred_by",
  other: "other",
};

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}

// How a link reads on `viewerId`'s profile. `type` is always stored from
// personId's side, so viewing it from the other end flips it.
export function linkTypeFor(
  viewerId: string,
  link: { personId: string; relatedPersonId: string; type: LinkType },
): LinkType {
  return link.personId === viewerId ? link.type : LINK_TYPE_INVERSE[link.type];
}
