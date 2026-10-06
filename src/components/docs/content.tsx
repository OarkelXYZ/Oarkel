import Link from "next/link";
import { BRAND, CHAIN, ONCHAIN, PONS } from "@/config/brand";

/**
 * Docs pages. Each page is a list of sections; every section heading becomes
 * an h2 with an anchor and an entry in the page's "On this page" list.
 * Nothing here describes deployed contracts: the pool is a planned design.
 */
export type DocSection = { id: string; h: string; body: React.ReactNode };
export type Doc = {
  slug: string;
  group: string;
  /** Sidebar label. */
  nav: string;
  /** The page's single h1. */
  h1: string;
  lede: string;
  /** Short title, rendered as "<title> | Oarkel". */
  title: string;
  description: string;
  keyword: string;
  sections: DocSection[];
};

const Callout = ({ children, tone = "note" }: { children: React.ReactNode; tone?: "note" | "warn" }) => (
  <div
    className={`not-prose mt-6 rounded-[10px] border-l-4 px-4 py-3.5 text-[15px] leading-relaxed ${
      tone === "warn" ? "border-surge bg-surge-soft/60 text-fg" : "border-fg bg-card-2 text-fg-2"
    }`}
  >
    {children}
  </div>
);

const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="table-scroll">
    <table className="min-w-[520px]">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const T = BRAND.symbol;
const N = BRAND.name;
const C = CHAIN.name;

export const DOCS: Doc[] = [
  /* ---------------------------------------------------------------- */
  {
    slug: "",
    group: "Overview",
    nav: "Introduction",
    h1: `What is ${N}?`,
    lede: `${N} is a privacy protocol for ${C}: a shared pool where ETH and ${T} are held as private notes, and where private holders earn the protocol's fees.`,
    title: "Docs",
    description: `${N} documentation: how the private pool on ${C} works, how shrouded ${T} earns from fees, and what is live today versus still planned.`,
    keyword: "privacy protocol documentation",
    sections: [
      {
        id: "the-problem",
        h: "The problem with a public ledger",
        body: (
          <>
            <p>
              Every account on {C} is an open book. Paste an address into the explorer and you get its balance, every token it holds and
              every transfer it ever made. That openness is what lets strangers verify each other, but it also means that the moment one
              address is tied to a person, through an exchange withdrawal, an ENS name or a payment to a friend, their whole financial
              history comes with it.
            </p>
            <p>
              {N} adds a private side to the same chain. Value moved into the {N} pool stops being a row anyone can read and becomes a
              <strong> note</strong>: an encrypted record that only its owner&apos;s keys can open. The contract still enforces every rule,
              but it does so by checking proofs instead of reading balances.
            </p>
          </>
        ),
      },
      {
        id: "what-is-different",
        h: `What sets ${N} apart`,
        body: (
          <ul>
            <li>
              <strong>Private by choice, not by chain.</strong> {T} is planned as an ordinary ERC-20 that wallets, explorers and DEXs
              handle as usual. You opt into privacy by shrouding, and opt out by unshrouding.
            </li>
            <li>
              <strong>Paid to stay private.</strong> Protocol fees are designed to flow into one vault owned by shrouded {T}. Public holders
              receive none of it.
            </li>
            <li>
              <strong>No operator.</strong> The planned contracts have no admin keys and no upgrade path, so nobody can freeze or move a
              note.
            </li>
            <li>
              <strong>No gas wallet needed.</strong> A relayer can submit transactions for you and take its fee from the note.
            </li>
          </ul>
        ),
      },
      {
        id: "status",
        h: "What is live today",
        body: (
          <>
            <p>
              Be clear about this before anything else: <strong>the {N} pool and its proof system are not deployed.</strong> There is no
              contract to deposit into, and the {T} contract address has not been published.
            </p>
            <p>What works today on this site:</p>
            <ul>
              <li>Connecting an EVM wallet, with {C} added automatically.</li>
              <li>Live chain readings: latest block, gas price and the Chainlink ETH/USD feed on {C}.</li>
              <li>
                The full <Link href="/app">app</Link> in practice mode: shroud, hold, send and unshroud with practice balances. Every
                action is a free wallet signature, no transaction is sent and no real value moves.
              </li>
            </ul>
            <Callout tone="warn">
              Any claim in these docs about immutability, missing admin keys or fees describes the contracts {N} intends to deploy. It
              becomes a fact only when those contracts are live and verified on the explorer.
            </Callout>
          </>
        ),
      },
      {
        id: "next",
        h: "Where to read next",
        body: (
          <ul>
            <li>
              <Link href="/docs/concepts">Core ideas</Link>: notes, commitments, nullifiers and proofs in plain words.
            </li>
            <li>
              <Link href="/docs/pool-and-yield">Vault and yield</Link>: how fees raise the value of private shares.
            </li>
            <li>
              <Link href="/docs/trust-model">Team powers</Link>: what the team will and will not be able to do.
            </li>
            <li>
              <Link href="/docs/get-started">First steps</Link>: walk through the practice app in five minutes.
            </li>
          </ul>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "concepts",
    group: "Overview",
    nav: "Core ideas",
    h1: "Core ideas",
    lede: `The handful of ideas behind ${N}, each in a paragraph.`,
    title: "Key Concepts",
    description: `The ideas behind ${N} explained simply: shrouding, private notes, commitments, nullifiers, the note tree, zero-knowledge proofs and exits.`,
    keyword: "private note commitment nullifier",
    sections: [
      {
        id: "shroud",
        h: "Shroud and unshroud",
        body: (
          <p>
            <strong>Shrouding</strong> means depositing ETH or {T}. That deposit is an ordinary transaction, so the sending address and
            its size show up on the explorer, and the pool records a fresh note in exchange. <strong>Unshrouding</strong> runs the other
            way: value leaves for an ordinary address. The amount and recipient of an exit are public; which note paid for it is not.
          </p>
        ),
      },
      {
        id: "note",
        h: "Note",
        body: (
          <p>
            A note is a private entry of value. It holds an owner key, an asset, an amount (or, for {T}, a number of vault shares) and
            two random values that make it unguessable. The chain never keeps a note in readable form: it holds a hash of it plus a
            ciphertext only the owner can open.
          </p>
        ),
      },
      {
        id: "commitment",
        h: "Commitment",
        body: (
          <p>
            A commitment is a hash of a note&apos;s contents. It shows a note is real while disclosing none of its contents: two
            commitments for wildly different amounts look exactly alike. Every commitment is appended to the note tree.
          </p>
        ),
      },
      {
        id: "nullifier",
        h: "Nullifier",
        body: (
          <p>
            Spending a note publishes its nullifier, a tag computed from the note and the owner&apos;s secret key. The pool keeps a set
            of nullifiers it has seen and refuses any repeat, which stops a note from being spent twice. Nobody without the key can link a
            nullifier back to the commitment it came from.
          </p>
        ),
      },
      {
        id: "tree",
        h: "Note tree and root",
        body: (
          <p>
            Every commitment is appended to a single Merkle tree. The tree&apos;s root summarises its entire contents at one instant.
            Each proof names a root, and the pool honours a window of recent ones, so a proof made a few blocks ago still verifies
            while new notes keep arriving.
          </p>
        ),
      },
      {
        id: "proof",
        h: "Zero-knowledge proof",
        body: (
          <p>
            When you spend, your browser builds a zero-knowledge proof showing the spent notes belong to you, sit in the tree, produce the
            right nullifiers, and that no value is created out of thin air. The contract checks the
            proof and learns none of the private inputs.
          </p>
        ),
      },
      {
        id: "shares",
        h: "Vault shares",
        body: (
          <p>
            Shrouded {T} is counted in vault shares rather than raw tokens. When fees are added to the vault, the number of shares stays
            the same while the {T} behind them grows, so each share is worth more. That is the whole yield mechanism.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "get-started",
    group: `Using ${N}`,
    nav: "First steps",
    h1: "Get started with the practice app",
    lede: "Five minutes, one wallet, no funds at risk.",
    title: "Get Started",
    description: `Try ${N} before launch: connect a wallet to ${C}, open a practice account, then shroud, hold, send and unshroud without moving real funds.`,
    keyword: "how to use private pool",
    sections: [
      {
        id: "connect",
        h: "1. Connect a wallet",
        body: (
          <p>
            Press <strong>Connect wallet</strong> in the header and pick any EVM wallet that can add a custom network, such as MetaMask,
            Rabby or OKX Wallet. The site asks your wallet to add {C} (chain id {CHAIN.id}) and switch to it. Phantom cannot add custom
            networks, so it is listed but disabled.
          </p>
        ),
      },
      {
        id: "open",
        h: "2. Open a practice account",
        body: (
          <p>
            In the <Link href="/app">app</Link>, press <strong>Open practice account</strong> and sign the message your wallet shows. The
            signature costs nothing and sends no transaction. You receive a practice public balance of ETH and {T} to experiment with.
            Practice balances have no value and cannot be withdrawn anywhere.
          </p>
        ),
      },
      {
        id: "shroud",
        h: "3. Shroud something",
        body: (
          <p>
            On the <strong>Shroud</strong> tab, pick ETH or {T}, enter an amount and sign. The practice pool takes the example shroud fee
            and gives you a note with a fresh commitment. Your public practice balance drops; your private balance, visible only to you,
            rises.
          </p>
        ),
      },
      {
        id: "hold",
        h: "4. Hold and watch the vault",
        body: (
          <p>
            The <strong>Overview</strong> tab shows your notes and the practice vault. Every practice fee paid by any visitor goes into
            that vault, so the value of a shrouded {T} share moves only when real practice activity happens. Nothing is simulated on a
            timer.
          </p>
        ),
      },
      {
        id: "spend",
        h: "5. Send or unshroud",
        body: (
          <p>
            <strong>Send</strong> pays another practice account privately: they receive a new note and your note is spent.{" "}
            <strong>Unshroud</strong> withdraws to any address you type, minus the flat example fee. Withdrawing to your own address puts
            the value back in your public practice balance.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "get-oarkel",
    group: `Using ${N}`,
    nav: `Get ${T}`,
    h1: `How to get ${T}`,
    lede: `${T} is planned as a standard ERC-20 token for ${C}, listed through Pons.`,
    title: `Get ${T}`,
    description: `How to buy ${T} on ${C} once it launches: the Pons bonding curve, its Uniswap v4 pool after graduation, and how to check the official address.`,
    keyword: `buy ${BRAND.ticker}`,
    sections: [
      {
        id: "where",
        h: "Where it will trade",
        body: (
          <>
            <p>
              {T} launches on Pons, the launchpad on {C}. Until the token graduates, every buy and sell goes through its Pons bonding
              curve. After graduation, liquidity moves to a Uniswap v4 pool and aggregators can route trades to it. The{" "}
              <Link href="/token">token page</Link> has a buy card that quotes straight from the chain and switches on by itself once the
              address is published.
            </p>
            <p>
              Pons factory on {C}: <code>{PONS.factory}</code>.
            </p>
          </>
        ),
      },
      {
        id: "address",
        h: "Check the address first",
        body: (
          <>
            <p>
              The contract address is <strong>not published yet</strong>. When it is, it will appear in three places at once: the token
              page, the footer of this site and the {BRAND.xHandle} account on X. Tokens that copy the name and ticker are common on every
              chain; the address is the only identity that matters.
            </p>
            <Callout tone="warn">Until the address appears here, any token calling itself {T} is not ours.</Callout>
          </>
        ),
      },
      {
        id: "then-shroud",
        h: "Then shroud it",
        body: (
          <p>
            A purchase sits publicly in your wallet, like any trade. To earn from the fee vault, shroud it. Buying directly as a
            note, paying ETH inside the app, is planned for a later release.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "shroud-and-unshroud",
    group: `Using ${N}`,
    nav: "Shrouding and exits",
    h1: "Shrouding and exits",
    lede: "How value enters the pool and how it leaves.",
    title: "Shrouding and Exits",
    description: `How shrouding moves ETH or ${T} into the ${N} private pool, what stays public, and how unshrouding withdraws to any address with a proof.`,
    keyword: "shroud ETH private pool",
    sections: [
      {
        id: "shrouding",
        h: "Shrouding",
        body: (
          <>
            <p>A shroud is one transaction from your wallet to the pool:</p>
            <ol>
              <li>Your browser creates a new note and its commitment locally.</li>
              <li>You send ETH, or approve and send {T}, together with the commitment and the encrypted note.</li>
              <li>The pool takes the shroud fee, appends the commitment to the note tree and emits it in an event.</li>
            </ol>
            <p>
              Everyone can see that your address deposited a certain amount. From then on, nobody can see what that note does next.
            </p>
          </>
        ),
      },
      {
        id: "unshrouding",
        h: "Unshrouding",
        body: (
          <>
            <p>
              To withdraw, your browser picks notes that cover the amount, builds a proof and submits it with the recipient address. The
              pool checks the proof, records the nullifiers, pays the recipient and stores a change note for whatever is left.
            </p>
            <p>
              The recipient can be any address, including one that has never been used. That is the point: there is no public link between
              the deposit that funded a note and the exit that spent it.
            </p>
          </>
        ),
      },
      {
        id: "what-is-public",
        h: "What stays public",
        body: (
          <Table
            head={["Event", "Public", "Private"]}
            rows={[
              ["Shroud", "Depositing address, asset, amount, time", "Which note it became"],
              ["Private transfer", "That a transfer happened, its fee", "Sender, recipient, amount"],
              ["Unshroud", "Recipient, asset, amount, time", "Which notes paid for it, who owned them"],
            ]}
          />
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "send-privately",
    group: `Using ${N}`,
    nav: "Private payments",
    h1: "Private payments",
    lede: "Paying someone without leaving a public trail.",
    title: "Private Payments",
    description: `How a private transfer inside ${N} works: spend your note, create a new one for the recipient, and keep sender, receiver and amount off the public ledger.`,
    keyword: "private transfer",
    sections: [
      {
        id: "how",
        h: "Inside a private payment",
        body: (
          <>
            <p>
              A private transfer spends one or more of your notes and creates new ones: one owned by the recipient&apos;s key for the
              amount you are paying, and one owned by you for the change. On-chain, the transaction shows nullifiers going in and
              commitments coming out, and nothing else.
            </p>
            <p>
              Recipients discover incoming notes by scanning fresh ciphertexts with their viewing key. No address of theirs appears anywhere in
              the transaction.
            </p>
          </>
        ),
      },
      {
        id: "receiving",
        h: "Receiving",
        body: (
          <p>
            To be paid privately you share a <strong>shielded address</strong>, derived from your keys, instead of your wallet address. In
            the practice app the recipient is simply another practice account, identified by its wallet address, so you can try the flow
            with a second wallet.
          </p>
        ),
      },
      {
        id: "proof-of-payment",
        h: "Proving a payment later",
        body: (
          <p>
            Sometimes you need to show that you paid: an invoice, a dispute, an accountant. The planned design lets the sender produce a
            payment receipt that reveals one transfer, its amount and its recipient, without exposing any other note.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "fees",
    group: `Using ${N}`,
    nav: "Fee schedule",
    h1: "Fee schedule",
    lede: "Every fee source, its destination, and which numbers are still open.",
    title: "Fee Schedule",
    description: `Every planned ${N} fee in one table: creator fee on ${T} trades, shroud fee, flat unshroud fee and private transfer fee, and where each one goes.`,
    keyword: "privacy protocol fees",
    sections: [
      {
        id: "table",
        h: "Fee sources",
        body: (
          <>
            <Table
              head={["Fee", "Charged on", "Goes to", "Status"]}
              rows={[
                [`Creator fee`, `Every ${T} buy and sell on Pons`, "Harvested, mostly to buy back for the vault", "Planned"],
                ["Shroud fee", "Each deposit into the pool", "Fee vault", "Planned"],
                ["Unshroud fee", "Each withdrawal, flat amount", "Fee vault", "Planned"],
                ["Private transfer fee", "Each payment inside the pool", "Fee vault", "Planned"],
                ["Relayer fee", "Transactions sent through a relayer", "The relayer that paid the gas", "Optional"],
              ]}
            />
            <Callout tone="warn">
              No rate is final. Rates will be fixed in the contracts before launch and cannot change afterwards. The practice app uses
              example rates, shown on each screen.
            </Callout>
          </>
        ),
      },
      {
        id: "flat-exit",
        h: "Why the unshroud fee is flat",
        body: (
          <p>
            A percentage exit fee would leak the size of the note being spent, and a fee tied to how old a note is would leak
            when it was created. A flat fee says nothing about either. The cost is that very small withdrawals are not worth making.
          </p>
        ),
      },
      {
        id: "public-holders",
        h: "What public holders get",
        body: (
          <p>
            No fee share. Public {T} can still benefit indirectly, since buybacks support the price and every shrouded token leaves the
            public float smaller, but yield itself is reserved for the vault.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "staying-private",
    group: `Using ${N}`,
    nav: "Privacy habits",
    h1: "Privacy habits",
    lede: "The pool hides the path. These habits stop you from giving it away.",
    title: "Privacy Habits",
    description: `Practical habits for using ${N} without undoing your own privacy: fresh exit addresses, round amounts, waiting between deposit and withdrawal.`,
    keyword: "on-chain privacy tips",
    sections: [
      {
        id: "habits",
        h: "Habits that matter",
        body: (
          <ul>
            <li>
              <strong>Withdraw to an unused address.</strong> Withdrawing to the address that deposited links the two ends for anyone watching.
            </li>
            <li>
              <strong>Do not mirror amounts.</strong> Depositing 3.1427 ETH and withdrawing 3.1427 ETH an hour later is a fingerprint.
              Round numbers blend in.
            </li>
            <li>
              <strong>Let time pass.</strong> The longer a note sits, the more deposits and withdrawals happen around it.
            </li>
            <li>
              <strong>Use a relayer.</strong> Funding a fresh address with gas from your main wallet reconnects them.
            </li>
            <li>
              <strong>Mind the network layer.</strong> {N} cannot mask your IP address; the RPC you use and the sites you visit can still
              see it.
            </li>
          </ul>
        ),
      },
      {
        id: "crowd",
        h: "Why the crowd matters",
        body: (
          <p>
            A note can only hide among other notes. A pool with ten users protects poorly however good the cryptography is. Every new
            participant makes everyone else harder to single out, which is also why community coins are planned to share one pool
            instead of starting their own. The <Link href="/research">research notes</Link> look at this in detail.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "pool-and-yield",
    group: "Protocol",
    nav: "Vault and yield",
    h1: "Vault and yield",
    lede: `How fees turn into passive yield for shrouded ${T}.`,
    title: "Vault and Yield",
    description: `How the ${N} fee vault works: shrouded ${T} is counted in shares, fees add backing without new shares, so each private share grows in value.`,
    keyword: "passive yield private holders",
    sections: [
      {
        id: "vault",
        h: "One vault behind every private share",
        body: (
          <>
            <p>
              Shrouded {T} does not sit in notes as a token count. It sits as a number of shares in one vault. Shrouding issues shares at
              today&apos;s rate; unshrouding burns them and pays out the {T} they represent. Fees raise the vault&apos;s backing and create no new
              shares.
            </p>
            <pre>
              <code>{`shares_out = amount_in * (total_shares + OFFSET) / (total_backing + 1)
amount_out = shares_in * (total_backing + 1) / (total_shares + OFFSET)`}</code>
            </pre>
            <p>
              The small virtual offset is a standard guard against the share-inflation trick where a first depositor manipulates the rate.
            </p>
          </>
        ),
      },
      {
        id: "example",
        h: "A worked example",
        body: (
          <p>
            The vault holds 1,000,000 {T} of backing and 1,000,000 shares. You hold a note worth 10,000 shares. Over a month, 30,000{" "}
            {T} of fees arrive. Shares are now worth 1.03 {T} each, and your note withdraws 10,300 {T} minus the flat exit fee. A public
            wallet holding 10,000 {T} through the same month still holds 10,000. These numbers are illustrative; real yield depends on
            real fee income and may be nothing.
          </p>
        ),
      },
      {
        id: "eth-notes",
        h: "What about shrouded ETH",
        body: (
          <p>
            ETH notes stay ETH, one for one, so a shrouded ETH balance is exactly what you deposited minus fees. The fees ETH notes pay
            are planned to be swapped into {T} and donated to the vault, so ETH activity feeds the yield of private {T} holders.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "oarkel-on-pons",
    group: "Protocol",
    nav: `${T} on Pons`,
    h1: `${T} on Pons`,
    lede: `Why ${T} launches on Pons and how its creator fee reaches the vault.`,
    title: `${T} on Pons`,
    description: `How ${T} launches on the Pons launchpad on ${C}, graduates to Uniswap v4, and how its creator fee is planned to fund the ${N} vault.`,
    keyword: "Pons launchpad token",
    sections: [
      {
        id: "launch",
        h: "Launch and graduation",
        body: (
          <p>
            Pons launches tokens on a bonding curve: the price rises with each buy and falls with each sell, against ETH, until the curve
            fills. At that point the token graduates and its liquidity moves to a Uniswap v4 pool on {C}, where it trades like any other
            pair.
          </p>
        ),
      },
      {
        id: "creator-fee",
        h: "The creator fee",
        body: (
          <p>
            Each Pons trade carries a creator fee owed to the launching wallet. For {T}, that fee is planned to be collected by a
            harvester contract that swaps most of it into {T} and donates it to the vault, with a smaller share to the team. Until the
            harvester exists, the routing is a commitment, not code, and the docs will say so.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "note-tree",
    group: "Protocol",
    nav: "Commitment tree",
    h1: "The commitment tree",
    lede: "Where commitments are stored and how proofs refer to them.",
    title: "Commitment Tree",
    description: `How ${N} stores every private note commitment in one append-only Merkle tree, and why the pool keeps a window of recent roots for proofs.`,
    keyword: "Merkle tree commitments",
    sections: [
      {
        id: "append-only",
        h: "Append-only by design",
        body: (
          <p>
            Every new commitment, from shrouds, transfers and change outputs, is appended as the next leaf of a fixed-depth Merkle tree.
            Nothing is ever removed: spent notes stay in the tree and are excluded only by their nullifiers. That keeps an exit from
            revealing which leaf was spent.
          </p>
        ),
      },
      {
        id: "roots",
        h: "Recent roots",
        body: (
          <p>
            Each insertion produces a new root. The pool remembers a window of recent roots, so proofs made a few blocks earlier still
            verify. Which root a wallet chooses can itself leak timing; see the{" "}
            <Link href="/research/root-timing">root timing note</Link>.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "proof-circuit",
    group: "Protocol",
    nav: "The proof circuit",
    h1: "The proof circuit",
    lede: "A single circuit handles transfers and exits alike.",
    title: "The Proof Circuit",
    description: `What the single ${N} zero-knowledge circuit proves for transfers and exits: note ownership, tree membership, correct nullifiers and conserved value.`,
    keyword: "zero-knowledge proof circuit",
    sections: [
      {
        id: "statement",
        h: "What a proof says",
        body: (
          <ul>
            <li>Each spent note appears in the tree under the named root.</li>
            <li>The prover holds the key that owns each input note.</li>
            <li>Each published nullifier is computed correctly from its input note.</li>
            <li>Inputs equal outputs plus the public exit amount plus fees, for the same asset.</li>
            <li>Every output commitment is well formed.</li>
          </ul>
        ),
      },
      {
        id: "choices",
        h: "Design choices still open",
        body: (
          <p>
            The proving system, hash function and tree depth are being chosen for proving speed in a browser and verification cost on{" "}
            {C}. They will be listed on the <Link href="/docs/parameters">parameters page</Link> once fixed, together with the circuit
            source.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "keys",
    group: "Protocol",
    nav: "Key derivation",
    h1: "Key derivation",
    lede: "How note keys are derived and what each one allows.",
    title: "Key Derivation",
    description: `How ${N} derives spending and viewing keys from one wallet signature, so the same wallet restores your private notes on any device.`,
    keyword: "viewing key spending key",
    sections: [
      {
        id: "derivation",
        h: "One signature, every key",
        body: (
          <p>
            Your wallet signs a fixed message once. That signature is hashed into a seed, and the seed derives your note keys. Because the
            same wallet always produces the same signature for the same message, you can restore your notes on a new device with nothing
            to back up beyond the wallet itself.
          </p>
        ),
      },
      {
        id: "roles",
        h: "What each key can do",
        body: (
          <Table
            head={["Key", "Can", "Cannot"]}
            rows={[
              ["Spending key", "Spend notes, build proofs", "Nothing beyond your own notes"],
              ["Viewing key", "Read your notes and history", "Spend anything"],
              ["Shielded address", "Receive private payments", "Read or spend"],
            ]}
          />
        ),
      },
      {
        id: "sharing",
        h: "Sharing a viewing key",
        body: (
          <p>
            Handing a viewing key to an auditor or tax adviser lets them read your history without being able to move funds. Scoped
            keys that reveal only a date range are on the <Link href="/docs/roadmap">roadmap</Link>.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "relayer",
    group: "Protocol",
    nav: "Relayers and gas",
    h1: "Relayers and gas",
    lede: "Using the pool without holding ETH for gas.",
    title: "Relayers and Gas",
    description: `How ${N} relayers submit shroud and unshroud transactions and pay the gas, taking their fee from the note so your exit address needs no ETH.`,
    keyword: "gasless relayer",
    sections: [
      {
        id: "why",
        h: "Why gas is a privacy problem",
        body: (
          <p>
            A fresh address cannot send a transaction until it holds ETH for gas, and funding it out of your everyday wallet links the two.
            Relayers remove that step.
          </p>
        ),
      },
      {
        id: "how",
        h: "How relaying works",
        body: (
          <p>
            You build the proof in your browser with the relayer&apos;s fee written into it, then hand the proof to a relayer. The relayer
            submits the transaction and pays the gas; the pool pays the relayer its fee out of the spent note. The relayer cannot alter where
            the money goes or how much, because both are bound into the proof.
          </p>
        ),
      },
      {
        id: "open",
        h: "Anyone can relay",
        body: (
          <p>
            Relaying is planned to be permissionless. If every relayer is down, you can still submit your own proof from any funded
            wallet; you only lose the gas convenience, never access to your notes.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "deployments",
    group: "Developers",
    nav: "Deployments",
    h1: "Deployments",
    lede: `Contract addresses on ${C}, once there are any.`,
    title: "Deployments",
    description: `Official ${N} deployment list for ${C}: pool, verifier, vault and ${T} addresses, plus the existing contracts the site reads from today.`,
    keyword: "contract addresses",
    sections: [
      {
        id: "oarkel",
        h: `${N} contracts`,
        body: (
          <>
            <Table
              head={["Contract", "Address", "Status"]}
              rows={[
                [`${T} token`, "Not published", "Launch on Pons pending"],
                ["Private pool", "Not deployed", "In design"],
                ["Proof verifier", "Not deployed", "In design"],
                ["Fee harvester", "Not deployed", "In design"],
              ]}
            />
            <Callout tone="warn">This table is the source of truth. Addresses posted anywhere else should be checked against it.</Callout>
          </>
        ),
      },
      {
        id: "read",
        h: "Contracts this site reads today",
        body: (
          <Table
            head={["Contract", "Address", "Used for"]}
            rows={[
              ["Chainlink ETH / USD", <code key="a">{ONCHAIN.ethUsdFeed}</code>, "The ETH price on the live strip"],
              ["WETH", <code key="b">{ONCHAIN.weth}</code>, "Reference"],
              ["Pons factory", <code key="c">{PONS.factory}</code>, "Token buy card, once the address is live"],
            ]}
          />
        ),
      },
      {
        id: "network",
        h: "Network",
        body: (
          <p>
            {C} mainnet, chain id {CHAIN.id} ({CHAIN.hex}), native gas token ETH, explorer{" "}
            <a href={CHAIN.explorer} target="_blank" rel="noreferrer">
              robinhoodchain.blockscout.com
            </a>
            .
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "contracts",
    group: "Developers",
    nav: "Planned contracts",
    h1: "Planned contracts",
    lede: "The interface the pool is being designed around. Subject to change until deployment.",
    title: "Planned Contracts",
    description: `The planned ${N} smart contract interface: pool functions for shroud, transact and unshroud, the events wallets index, and the errors to expect.`,
    keyword: "privacy pool smart contract",
    sections: [
      {
        id: "functions",
        h: "Pool functions",
        body: (
          <Table
            head={["Function", "Who calls it", "What it does"]}
            rows={[
              [<code key="1">shroud(asset, amount, commitment, encryptedNote)</code>, "Depositor", "Takes the deposit and fee, appends the commitment"],
              [<code key="2">transact(proof, root, nullifiers, commitments, encryptedNotes, fee)</code>, "Anyone, usually a relayer", "Private transfer"],
              [<code key="3">unshroud(proof, root, nullifiers, change, recipient, amount, relayerFee)</code>, "Anyone, usually a relayer", "Withdraws to the recipient"],
              [<code key="4">donate(amount)</code>, "Anyone", `Adds ${T} to the vault backing`],
            ]}
          />
        ),
      },
      {
        id: "events",
        h: "Events",
        body: (
          <ul>
            <li>
              <code>NoteAdded(index, commitment, encryptedNote)</code>: one per new leaf; wallets scan these to find their notes.
            </li>
            <li>
              <code>NullifierSpent(nullifier)</code>: one per spent note.
            </li>
            <li>
              <code>Unshrouded(recipient, asset, amount)</code>: the public side of an exit.
            </li>
            <li>
              <code>Donated(amount)</code>: fees reaching the vault.
            </li>
          </ul>
        ),
      },
      {
        id: "no-admin",
        h: "What is deliberately missing",
        body: (
          <p>
            No <code>owner</code>, no <code>upgradeTo</code>, no function that moves or freezes a note, and no fee setter. Parameters are
            constructor arguments. A separate guardian may be able to stop new shrouds during a staged rollout; it is planned to have no
            power over transfers or exits.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "integrations",
    group: "Developers",
    nav: "Integrations",
    h1: "Integrations",
    lede: `How wallets, apps and launchpads can build on ${N}.`,
    title: "Integrations",
    description: `How wallets, exchanges and community launchpads can integrate with ${N}: indexing notes, accepting private payments and routing exits.`,
    keyword: "privacy pool integration",
    sections: [
      {
        id: "wallets",
        h: "Wallets",
        body: (
          <p>
            A wallet integration needs three things: key derivation from a signature, an indexer for <code>NoteAdded</code> events to find
            the user&apos;s notes, and the prover to build proofs locally. A reference SDK is planned alongside the contracts.
          </p>
        ),
      },
      {
        id: "merchants",
        h: "Accepting private payments",
        body: (
          <p>
            A merchant shares a shielded address and watches for notes paid to it, then unshrouds to a treasury address on its own
            schedule. Payment receipts let a customer prove a specific payment if there is a dispute.
          </p>
        ),
      },
      {
        id: "communities",
        h: "Community privacy coins",
        body: (
          <p>
            Later releases plan to let other {C} tokens join the same pool under their own asset id, so a new community coin gains the
            existing crowd on day one instead of starting with an empty, easily traced pool.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "trust-model",
    group: "Safety",
    nav: "Team powers",
    h1: "Team powers and commitments",
    lede: "Commitments from the team, its remaining powers, and the open questions.",
    title: "Team Powers",
    description: `The ${N} trust model: no admin keys, no upgradeable proxy, exits that cannot be paused, honest labeling, and what remains unproven before launch.`,
    keyword: "no admin keys immutable",
    sections: [
      {
        id: "commitments",
        h: "Commitments",
        body: (
          <ul>
            <li>No admin key over funds, and no upgradeable proxy on the pool.</li>
            <li>No pause on private transfers or exits, ever. At most, new deposits can be capped during rollout.</li>
            <li>No hidden team allocation; any team or seeded deposit is labeled.</li>
            <li>No promise of yield. Yield is whatever real fees produce, which can be nothing.</li>
            <li>No claim that deposits and withdrawals are hidden. They are public by nature.</li>
          </ul>
        ),
      },
      {
        id: "powers",
        h: "Team powers after deployment",
        body: (
          <Table
            head={["Will be able to", "Will not be able to"]}
            rows={[
              ["Cap or halt new shrouds during rollout", "Pause transfers, exits or donations"],
              ["Choose settings ahead of deployment", "Alter a setting once deployed"],
              ["Collect the team's portion of each creator fee", "Move, freeze or redirect any note"],
            ]}
          />
        ),
      },
      {
        id: "unproven",
        h: "Not proven yet",
        body: (
          <p>
            Nothing is deployed, so none of the above is verifiable today. No third-party review has been done. These docs will link the
            review, the verified source and the deployment block as each one happens.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "threat-model",
    group: "Safety",
    nav: "What it protects",
    h1: "What it protects",
    lede: `What ${N} protects against, and what it does not.`,
    title: "What It Protects",
    description: `What ${N} privacy protects against on ${C}, from chain analysts to curious counterparties, and the risks it cannot remove, like immutable bugs.`,
    keyword: "privacy threat model",
    sections: [
      {
        id: "protects",
        h: "Protects against",
        body: (
          <ul>
            <li>Anyone reading the chain learning your private balance or who you paid inside the pool.</li>
            <li>A counterparty seeing your other holdings after you pay them.</li>
            <li>Linking a deposit to a later exit by reading on-chain data alone, given a healthy crowd and good habits.</li>
          </ul>
        ),
      },
      {
        id: "does-not",
        h: "Does not protect against",
        body: (
          <ul>
            <li>Your own links: exiting to your deposit address, mirrored amounts, funding gas from a known wallet.</li>
            <li>Network-level observers who see your IP address, or services you log into.</li>
            <li>A compromised device or wallet: whoever holds your keys holds your notes.</li>
            <li>A small pool. With few participants, timing and amounts can narrow things down.</li>
          </ul>
        ),
      },
      {
        id: "contract-risk",
        h: "Contract risk",
        body: (
          <p>
            An immutable contract cannot be patched. If a bug is found after launch, the only remedy is a new pool that users choose to
            move to. Staged deposit caps, a public review and a bounty are planned to limit how much is exposed while the code earns
            trust.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "parameters",
    group: "Reference",
    nav: "Parameters",
    h1: "Parameters",
    lede: "The fixed values of the planned pool. Most are not decided yet.",
    title: "Parameters",
    description: `Planned ${N} pool parameters: assets, fee rates, root window, share offset and proof settings, with the status of each value before deployment.`,
    keyword: "protocol parameters",
    sections: [
      {
        id: "values",
        h: "Values",
        body: (
          <Table
            head={["Parameter", "Planned value", "Status"]}
            rows={[
              ["Assets", `ETH, ${T}`, "Decided"],
              ["Network", `${C} (${CHAIN.id})`, "Decided"],
              ["Shroud fee", "Small percentage", "To be set"],
              ["Unshroud fee", "Flat amount per exit", "To be set"],
              ["Private transfer fee", "Small percentage", "To be set"],
              ["Recent roots accepted", "A rolling window", "To be set"],
              ["Vault share offset", "Virtual offset against inflation attacks", "To be set"],
              ["Proof system and hash", "Browser-friendly SNARK", "To be chosen"],
            ]}
          />
        ),
      },
      {
        id: "practice",
        h: "Practice app values",
        body: (
          <p>
            The practice app uses example values so the flow can be tried: a 0.25% shroud fee, a 0.10% private transfer fee and a flat
            unshroud fee of 0.0005 ETH or 20 {T}. They are not proposals for the real contracts.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "glossary",
    group: "Reference",
    nav: "Glossary",
    h1: "Glossary",
    lede: `Terms used across the ${N} site and docs.`,
    title: "Glossary",
    description: `Glossary of ${N} terms: shroud, unshroud, note, commitment, nullifier, root, vault share, relayer, viewing key and anonymity set, explained briefly.`,
    keyword: "privacy glossary",
    sections: [
      {
        id: "terms",
        h: "Terms",
        body: (
          <dl className="mt-4 grid grid-cols-1 gap-4">
            {(
              [
                ["Anonymity set", "How many notes look equally likely to be yours. More is safer."],
                ["Commitment", "Public hash of a note; reveals nothing about it."],
                ["Exit", "Another word for unshroud: withdrawing value back to an ordinary address."],
                ["Note", "Private balance entry inside the pool, readable only with the owner's keys."],
                ["Nullifier", "Revealed on spending; blocks double spends without exposing the note."],
                ["Relayer", "A service that submits your transaction and pays gas, paid from the note."],
                ["Root", "Summary hash of every commitment so far; each proof names one."],
                ["Shielded address", "What you share to receive private payments."],
                ["Shroud", "Move public value in, receiving a note."],
                ["Vault share", `Unit that shrouded ${T} is counted in; grows in value as fees arrive.`],
                ["Viewing key", "Lets its holder read your notes but not spend them."],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="border-b border-line pb-3">
                <dt className="font-semibold text-fg">{k}</dt>
                <dd className="mt-1">{v}</dd>
              </div>
            ))}
          </dl>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "research",
    group: "Reference",
    nav: "Research",
    h1: "Research",
    lede: "Open questions the team is working through, with interactive notes.",
    title: "Research Overview",
    description: `The ${N} research agenda: leaks from root choice and exit amounts, batched exits, note refresh, measuring real anonymity and hidden storage access.`,
    keyword: "privacy research",
    sections: [
      {
        id: "why",
        h: "Why publish research",
        body: (
          <p>
            Cryptography hides the contents of a note; it does not stop the metadata around it from talking. Timing, amounts and the
            choice of root can all narrow down who is behind an exit. The team writes these leaks up in the open, each with a small
            interactive model, before deciding how the pool should handle them.
          </p>
        ),
      },
      {
        id: "notes",
        h: "The notes",
        body: (
          <ul>
            <li>
              <Link href="/research/root-timing">Every root dates your note</Link>
            </li>
            <li>
              <Link href="/research/round-exits">Round exits blend in</Link>
            </li>
            <li>
              <Link href="/research/batched-exits">Exits that leave together</Link>
            </li>
            <li>
              <Link href="/research/note-refresh">Refreshing old notes</Link>
            </li>
            <li>
              <Link href="/research/counting-the-crowd">Counting the real crowd</Link>
            </li>
            <li>
              <Link href="/research/hidden-lookups">Lookups that leave no trace</Link>
            </li>
          </ul>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "roadmap",
    group: "Reference",
    nav: "Roadmap",
    h1: "Roadmap",
    lede: "The planned sequence. Intentions, not guarantees.",
    title: "Roadmap",
    description: `The ${N} roadmap: private pool and holder yield first, then relayers and private settlement, private swaps and community privacy coins on ${C}.`,
    keyword: "privacy protocol roadmap",
    sections: [
      {
        id: "now",
        h: "Now: site, practice app, token launch",
        body: (
          <ul>
            <li>This site, live chain readings and the practice app.</li>
            <li>{T} launch on Pons, with the address published here first.</li>
            <li>Contract and circuit design, written up in these docs.</li>
          </ul>
        ),
      },
      {
        id: "next",
        h: "Next: the pool and its fee vault",
        body: (
          <ul>
            <li>Private pool for ETH and {T}, with the fee vault and flat exit fee.</li>
            <li>Public review, staged deposit caps and a bounty sized to the pool.</li>
            <li>Fee harvester routing the creator fee into the vault.</li>
          </ul>
        ),
      },
      {
        id: "then",
        h: "Then: relayers and private settlement",
        body: (
          <ul>
            <li>Permissionless relayers so no exit address ever needs gas.</li>
            <li>Payment receipts and scoped viewing keys for business use.</li>
          </ul>
        ),
      },
      {
        id: "later",
        h: "Later: swaps and community coins",
        body: (
          <ul>
            <li>Private swaps against other assets on {C}.</li>
            <li>Community privacy coins launching into the shared pool.</li>
          </ul>
        ),
      },
    ],
  },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug);
