import { BRAND } from "@/config/brand";
import { BatchedExitsDemo, CrowdDemo, HiddenLookupsDemo, NoteRefreshDemo, RootTimingDemo, RoundExitsDemo } from "@/components/research/Demos";

/** Research notes: one leak or defence each, with a small model and a write-up. */
export type ResearchNote = {
  slug: string;
  title: string;
  summary: string;
  description: string;
  Demo: () => React.ReactElement;
  body: { h: string; p: string[] }[];
};

const N = BRAND.name;

export const NOTES: ResearchNote[] = [
  {
    slug: "root-timing",
    title: "Every root dates your note",
    summary: "The root a proof refers to quietly tells everyone roughly when the spent note was created.",
    description: `${N} research: why the Merkle root a wallet proves against can reveal when a note was inserted, and how always using the newest root closes that leak.`,
    Demo: RootTimingDemo,
    body: [
      {
        h: "The leak",
        p: [
          "A proof says: one of the notes in the tree under this root is mine. If a wallet proves against the first root that contained its note, an observer learns the note is one of the notes inserted up to that point and, often, close to the end of that range.",
          "A pool that accepts a window of recent roots makes this worse when wallets choose carelessly, because the choice of root becomes a timestamp attached to every spend.",
        ],
      },
      {
        h: "The fix being considered",
        p: [
          "Wallets should always prove against the newest root the pool knows. Then every spend points at the same, latest tree, and the candidate set is every note ever inserted rather than a slice of them.",
          "The trade-off is a race: a new insertion can land between building the proof and submitting it. Accepting a short window of recent roots keeps that from failing transactions while the wallet still aims for the newest.",
        ],
      },
    ],
  },
  {
    slug: "round-exits",
    title: "Round exits blend in",
    summary: "An exact withdrawal amount is a fingerprint. Restricting exits to round values makes them common.",
    description: `${N} research: how exact withdrawal amounts identify a note, and how limiting exits to one significant digit hides them among identical exits.`,
    Demo: RoundExitsDemo,
    body: [
      {
        h: "The leak",
        p: [
          "If someone shrouds 12,347.81 and an exit of 12,347.81 appears later, no cryptography is needed to connect them. Even partial withdrawals leak when the remaining balance is later withdrawn in full.",
        ],
      },
      {
        h: "The fix being considered",
        p: [
          "The circuit could accept only exit amounts of the form m × 10^k, a single significant digit. An exit of 10,000 is shared with every other exit of 10,000, and whatever is left over stays in a note.",
          "It costs flexibility: paying an exact invoice publicly would take two exits or a private transfer first. For holders who exit rarely, that is a small price.",
        ],
      },
    ],
  },
  {
    slug: "batched-exits",
    title: "Exits that leave together",
    summary: "Paying every exit at a shared boundary removes the timing link between a request and its payout.",
    description: `${N} research: how paying withdrawals together at an epoch boundary removes the timing signal that links a deposit, a request and a payout.`,
    Demo: BatchedExitsDemo,
    body: [
      {
        h: "The leak",
        p: [
          "When an exit is paid the moment it is requested, its timestamp can be matched against other activity, such as a deposit minutes earlier or a wallet that just woke up.",
        ],
      },
      {
        h: "The fix being considered",
        p: [
          "Proofs could queue as they arrive and pay out together when an epoch closes. Every exit in the batch carries the same timestamp, so time stops being a way to tell them apart.",
          "The cost is waiting up to one epoch for funds. The epoch length is a balance between privacy and patience and has not been chosen.",
        ],
      },
    ],
  },
  {
    slug: "note-refresh",
    title: "Refreshing old notes",
    summary: "Spending a note into a fresh one of equal value stops age from being a signal.",
    description: `${N} research: why long-dormant notes stand out when they finally move, and how periodic refresh transactions make note age meaningless to an observer.`,
    Demo: NoteRefreshDemo,
    body: [
      {
        h: "The leak",
        p: [
          "Most notes are young, because most activity is recent. A note that sat for many months belongs to a thin tail, and when it moves, the set of notes it could be shrinks sharply.",
        ],
      },
      {
        h: "The fix being considered",
        p: [
          "A wallet can refresh notes now and then: a private transfer to itself that produces a new note of the same value. The new note looks like any recent one.",
          "Refreshes cost a transfer fee and gas, so wallets would do it rarely and at random, ideally through a relayer.",
        ],
      },
    ],
  },
  {
    slug: "counting-the-crowd",
    title: "Counting the real crowd",
    summary: "The number of notes in the pool is not the privacy you get. What an observer can rule out matters more.",
    description: `${N} research: why headcount overstates privacy, and how measuring the effective anonymity set in bits shows which leaks matter most.`,
    Demo: CrowdDemo,
    body: [
      {
        h: "Headcount is not privacy",
        p: [
          "A pool of twelve thousand notes sounds safe. But if amounts, timing, root choice and gas funding each rule out most of them, the real set of plausible senders behind one exit can be a handful.",
        ],
      },
      {
        h: "Measuring it",
        p: [
          "The useful number is the effective anonymity set: how many notes remain equally plausible after every observable is applied, often expressed in bits. Each bit is a halving. The model on this page uses assumed factors to show the shape of the problem, not measured ones.",
          "The plan is a public dashboard that estimates this from real pool data once a pool exists.",
        ],
      },
    ],
  },
  {
    slug: "hidden-lookups",
    title: "Lookups that leave no trace",
    summary: "Reading the same record the same way every time reveals which record you care about.",
    description: `${N} research: how oblivious access patterns stop a server or indexer from learning which notes a wallet is looking up, at the cost of extra reads.`,
    Demo: HiddenLookupsDemo,
    body: [
      {
        h: "The leak",
        p: [
          "Wallets ask indexers for data. If a wallet always fetches the same slot, the indexer learns which record matters to that wallet, even if the record itself is encrypted.",
        ],
      },
      {
        h: "The idea",
        p: [
          "Oblivious access touches and re-encrypts a randomly chosen path on every lookup, so the slots touched look the same whichever record was wanted. It costs bandwidth. For an indexer that serves note data, it would keep lookups from building a profile of each wallet.",
        ],
      },
    ],
  },
];

export const noteBySlug = (slug: string) => NOTES.find((n) => n.slug === slug);
