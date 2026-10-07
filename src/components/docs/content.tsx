import Link from "next/link";
import { BRAND, CHAIN, ONCHAIN, PONS, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";

/**
 * Docs pages. Each page is a list of sections; every section heading becomes
 * an h2 with an anchor and an entry in the page's "On this page" list.
 * Contract claims describe the written contracts in contracts/src. Nothing is
 * deployed until the addresses in src/config/contracts.ts are filled in.
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
    className={`not-prose mt-8 rounded-[8px] border border-l-[3px] border-white/10 bg-white/[0.025] px-5 py-4 text-[15.5px] leading-relaxed ${
      tone === "warn" ? "border-l-surge text-fg" : "border-l-white/50 text-white/80"
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

/** An address cell: the address once it is set, otherwise a plain "not deployed" label. */
const addrCell = (a: string, key: string, none = "Not deployed yet") => (isAddress(a) ? <code key={key}>{a}</code> : none);

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
              <strong>No operator.</strong> The pool contract has no owner, no admin function and no upgrade path, so nobody can freeze
              or move a note.
            </li>
            <li>
              <strong>Your wallet, your transactions.</strong> Every shroud, private send and unshroud is sent from your own wallet. No
              third party handles your proof.
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
              <strong>The {N} pool is live on {C}.</strong> The pool, its proof verifier and their libraries are deployed and verified, and
              the {T} contract address is published on this site.
            </p>
            <p>What works today on this site:</p>
            <ul>
              <li>Connecting an EVM wallet, with {C} added automatically.</li>
              <li>Live chain readings: latest block, gas price and the Chainlink ETH/USD feed on {C}.</li>
              <li>
                The <Link href="/app">app</Link>: shroud, hold, send and unshroud with real ETH and {T}. Every action is a transaction you
                sign from your own wallet, and the proof is built in your browser.
              </li>
            </ul>
            <Callout tone="warn">
              Every claim in these docs about immutability, the missing owner and admin function, or fees can be checked on chain: the
              addresses are on the <Link href="/docs/deployments">deployments page</Link>, the code is verified on the explorer, and{" "}
              <code>npm run verify-deployment</code> compares it with this repository. The contracts cannot be upgraded, so use amounts
              you are prepared to lose.
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
              <Link href="/docs/get-started">First steps</Link>: shroud, send and unshroud in five minutes.
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
    h1: "Get started with the pool",
    lede: "One wallet, a little ETH for gas, and about five minutes.",
    title: "Get Started",
    description: `Use ${N} on ${C}: connect a wallet, unlock your notes, then shroud, hold, send privately and unshroud ETH or ${T}.`,
    keyword: "how to use private pool",
    sections: [
      {
        id: "connect",
        h: "1. Connect a wallet",
        body: (
          <p>
            Press <strong>Connect wallet</strong> in the header and pick any EVM wallet that can add a custom network, such as MetaMask,
            Rabby or OKX Wallet. The site asks your wallet to add {C} (chain id {CHAIN.id}) and switch to it. Phantom cannot add custom
            networks, so it is listed but disabled. Keep a little ETH in the wallet: every pool action is a transaction you send yourself.
          </p>
        ),
      },
      {
        id: "unlock",
        h: "2. Unlock your notes",
        body: (
          <>
            <p>
              In the <Link href="/app">app</Link>, press <strong>Sign to unlock</strong>. Your wallet signs a sign-in message for{" "}
              {BRAND.domain}; that signature becomes the keys that own and read your private notes. It is not a transaction, costs nothing
              and never leaves the browser tab.
            </p>
            <p>
              You can add a passphrase of at least 8 characters. It is mixed into your keys, so the signature alone cannot spend your notes.
              See <Link href="/docs/keys">keys</Link> for how this works.
            </p>
            <Callout tone="warn">
              Sign only on {BRAND.domain}, and check that your wallet shows that domain. If you add a passphrase and forget it, notes made
              with it cannot be recovered by anyone, including the team.
            </Callout>
          </>
        ),
      },
      {
        id: "shroud",
        h: "3. Shroud something",
        body: (
          <p>
            On the <strong>Shroud</strong> tab, pick ETH or {T}, enter an amount and confirm in your wallet. The pool takes the 0.25% shroud
            fee and records a private note for the rest. The deposit itself is public: anyone can see that your address put that amount
            in. Your first {T} shroud asks for an approval first, so it takes two transactions. Start with a small amount.
          </p>
        ),
      },
      {
        id: "hold",
        h: "4. Hold and watch the vault",
        body: (
          <p>
            The <strong>Overview</strong> tab shows your notes, read from the chain and decrypted in your browser. {T} notes hold vault
            shares: every fee paid in {T}, and every {T} donated from the ETH fees, raises the value of each share. ETH notes keep their
            value and do not earn. See <Link href="/docs/pool-and-yield">pool and yield</Link>.
          </p>
        ),
      },
      {
        id: "spend",
        h: "5. Send or unshroud",
        body: (
          <>
            <p>
              <strong>Send</strong> pays someone privately: paste their private address (they copy it from their <strong>Settings</strong>{" "}
              page), enter an amount and confirm. Your notes are spent and two new ones appear, one for them and one for your change. The
              0.10% transfer fee applies to what you send.
            </p>
            <p>
              <strong>Unshroud</strong> takes value out to any address you type, minus the flat 0.0005 ETH or 20 {T} fee. The recipient
              and the amount are visible on chain; which note paid for it is not.
            </p>
            <p>
              For both, your browser builds the proof in a few seconds and your connected wallet sends the transaction, so it shows as the
              sender. Read <Link href="/docs/staying-private">staying private</Link> before moving larger amounts.
            </p>
          </>
        ),
      },
    ],
  },

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
              <li>Your browser picks a note owner hash and encrypts the note details to your own key.</li>
              <li>You send ETH, or approve and send {T}, together with the owner hash and the encrypted note.</li>
              <li>
                The pool takes the shroud fee, computes the note commitment from the amount it actually received, appends it to the note
                tree and emits it in an event.
              </li>
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
            To be paid privately you share a <strong>shielded address</strong>, derived from your keys, instead of your wallet address. The
            app calls it your private address; copy it from the <strong>Settings</strong> page. It reveals nothing about your wallet or
            your balance.
          </p>
        ),
      },
      {
        id: "proof-of-payment",
        h: "Proving a payment later",
        body: (
          <p>
            Sometimes you need to show that you paid: an invoice, a dispute, an accountant. Payment receipts are planned for a later
            release: the sender would produce a receipt that reveals one transfer, its amount and its recipient, and no other note.
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
    lede: "Every fee source, its rate, and where it goes.",
    title: "Fee Schedule",
    description: `Every ${N} fee in one table: creator fee on ${T} trades, 0.25% shroud fee, flat unshroud fee and 0.10% private transfer fee, and where each one goes.`,
    keyword: "privacy protocol fees",
    sections: [
      {
        id: "table",
        h: "Fee sources",
        body: (
          <>
            <Table
              head={["Fee", "Charged on", "Goes to", "Rate"]}
              rows={[
                [`Creator fee`, `Every ${T} buy and sell on Pons`, "Harvested, mostly to buy back for the vault", "Set by Pons; harvesting planned"],
                ["Shroud fee", "Each deposit into the pool", "Fee vault", "0.25%"],
                ["Unshroud fee", "Each withdrawal, flat amount", "Fee vault", `0.0005 ETH or 20 ${T}`],
                ["Private transfer fee", "Value sent to another key inside the pool", "Fee vault", "0.10%"],
              ]}
            />
            <Callout tone="warn">
              These are the values the pool was deployed with. Every rate is a constructor argument, fixed forever at deploy, and the
              contract refuses any fee above 5%. Fees paid in {T} raise the vault directly. Fees paid in ETH build up in the pool, anyone
              can sweep them to the fee address fixed at deploy, and the operator of that address is expected to swap them into {T} and
              donate them. That last step is operated off-chain, not enforced by code.
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
              <strong>Mind the sender.</strong> The wallet you connect sends every transaction and pays its gas, so it shows on chain
              next to each private send and exit. Unshroud to a fresh address rather than back to that wallet.
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
              The virtual offset (1,000,000 shares) is a standard guard against the share-inflation trick where a first depositor
              manipulates the rate. A transfer fee paid in {T} burns shares instead, so each remaining share is backed by a little more.
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
            ETH notes stay ETH, one for one, so a shrouded ETH balance is exactly what you deposited minus fees, and it earns no yield.
            The fees ETH notes pay build up in the pool; anyone can call <code>sweepEthFees()</code> to send them to the fee address
            fixed at deploy, whose operator is expected to swap them into {T} and donate them to the vault. That swap is an operated,
            off-chain step, not contract code.
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
            fee harvester, operated off-chain, that swaps most of it into {T} and donates it to the vault through{" "}
            <code>donate()</code>, with a smaller share to the team. Until the harvester runs, the routing is a commitment, not code,
            and the docs will say so.
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
            Every new commitment, from shrouds, transfers and change outputs, is appended as the next leaf of a Merkle tree of depth 24.
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
            Each insertion produces a new root. The contract keeps a ring of the 100 most recent roots, so proofs made a few blocks earlier still
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
            <li>
              The recipient, relayer and relayer fee match the transaction, through a hash of that data. This site always submits from
              your own wallet, so its proofs name no relayer and a relayer fee of zero.
            </li>
          </ul>
        ),
      },
      {
        id: "choices",
        h: "Proof system",
        body: (
          <p>
            Written in Noir, the circuit spends two notes into two new ones. Your browser proves it with UltraHonk (Barretenberg)
            in a web worker, in about four seconds. Hashes are Poseidon. There is no project-specific trusted setup: UltraHonk uses the
            public Aztec Ignition reference string. The on-chain verifier, HonkVerifier, is generated from the circuit with its
            verification key fixed in code. Every value is on the <Link href="/docs/parameters">parameters page</Link>.
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
    description: `How ${N} derives spending and viewing keys from one wallet signature and an optional passphrase, so the same wallet restores your private notes on any device.`,
    keyword: "viewing key spending key",
    sections: [
      {
        id: "derivation",
        h: "One signature, every key",
        body: (
          <p>
            Your wallet signs one Sign-In-with-Ethereum message for {BRAND.domain}. That signature, together with an optional passphrase
            you choose, is hashed into a seed, and the seed derives your note keys. The keys live only in the memory of the open tab.
            Because the same wallet always produces the same signature for the same message, you can restore your notes on a new device
            with nothing to back up beyond the wallet itself and, if you set one, the passphrase.
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
            Handing a viewing key to an accountant or tax adviser lets them read your history without being able to move funds. Scoped
            keys that reveal only a date range are on the <Link href="/docs/roadmap">roadmap</Link>.
          </p>
        ),
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  {
    slug: "gas",
    group: "Protocol",
    nav: "Gas and your wallet",
    h1: "Gas and your wallet",
    lede: "Who sends each transaction, and what that shows on chain.",
    title: "Gas and Your Wallet",
    description: `How ${N} transactions are sent: your own wallet submits every shroud, private send and unshroud and pays the gas in ETH, with no extra fee.`,
    keyword: "privacy pool gas",
    sections: [
      {
        id: "who",
        h: "Your wallet sends everything",
        body: (
          <p>
            Every shroud, private send, merge and unshroud is a transaction from the wallet you connect. It pays the gas in ETH, the same
            as any other transaction on {C}. There is no relayer and no service in between, and no fee beyond the pool&apos;s own rates.
          </p>
        ),
      },
      {
        id: "proof",
        h: "What the proof fixes",
        body: (
          <p>
            You build the proof in your browser and your wallet submits it. The recipient and amounts are bound into the proof, so nobody
            can change where the money goes or how much. The pool contract has a relayer field in each proof; this site always sets it to
            the zero address with a fee of zero, which lets your own wallet send it.
          </p>
        ),
      },
      {
        id: "visible",
        h: "What the sender reveals",
        body: (
          <>
            <p>
              The sending wallet is public: it shows on chain next to each private send and unshroud. The proof still hides which notes are
              spent and who owns them, and an unshroud can pay out to any address.
            </p>
            <ul>
              <li>Keep a little ETH in the connected wallet for gas.</li>
              <li>Unshroud to a fresh address rather than back to the wallet that shrouded.</li>
              <li>The address that receives an unshroud needs no ETH: it only receives.</li>
            </ul>
          </>
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
    description: `Official ${N} deployment list for ${C}: pool, proof verifier and ${T} addresses once live, plus the contracts the site reads today.`,
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
                [`${T} token`, addrCell(CONTRACTS.token, "t", "Not published"), isAddress(CONTRACTS.token) ? "Published" : "Launch on Pons pending"],
                ["Private pool", addrCell(CONTRACTS.pool, "p"), isAddress(CONTRACTS.pool) ? "Deployed" : "Written and tested, not deployed"],
                ["Proof verifier", addrCell(CONTRACTS.verifier, "v"), isAddress(CONTRACTS.verifier) ? "Deployed" : "Written and tested, not deployed"],
                ["Fee harvester", "Off-chain", "Planned (operated off-chain)"],
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
    nav: "Contracts",
    h1: "Contracts",
    lede: "What the pool contracts do: functions, events, errors and fixed settings.",
    title: "Pool Contracts",
    description: `The ${N} smart contracts: OarkelPool functions for shroud, transact and unshroud, events, errors, fixed parameters and how to verify them.`,
    keyword: "privacy pool smart contract",
    sections: [
      {
        id: "contracts",
        h: "The contracts",
        body: (
          <>
            <Table
              head={["Contract", "Role"]}
              rows={[
                ["OarkelPool", "The pool and fee vault. No owner, no admin function, no pause, no proxy; every parameter set in the constructor"],
                ["HonkVerifier", "UltraHonk proof verifier generated from the Noir circuit; verification key fixed in code"],
                ["PoseidonT3, PoseidonT4", "Poseidon hash libraries the pool links to"],
                ["ZKTranscriptLib, RelationsLib", "Libraries the verifier links to"],
              ]}
            />
            <p>
              The libraries and the verifier hold no state. All five are deployed and verified; their addresses are on the{" "}
              <Link href="/docs/deployments">deployments page</Link>.
            </p>
          </>
        ),
      },
      {
        id: "functions",
        h: "Pool functions",
        body: (
          <>
            <Table
              head={["Function", "Who calls it", "What it does"]}
              rows={[
                [
                  <code key="1">shroud(asset, amount, ownerHash, encryptedNote)</code>,
                  "Depositor (payable)",
                  `Takes ETH (asset 0) or ${T} (asset 1) minus the shroud fee; the pool computes the note commitment from the amount paid`,
                ],
                [
                  <code key="2">transact(proof, args, ext)</code>,
                  "Anyone with a valid proof (this site: your own wallet)",
                  "Private send: two notes in, two out. Value sent to another key pays the transfer fee, enforced inside the proof",
                ],
                [
                  <code key="3">unshroud(proof, args, ext)</code>,
                  "Anyone with a valid proof (this site: your own wallet)",
                  "Withdraws to any address, minus the flat fee",
                ],
                [<code key="4">donate(amount)</code>, "Anyone", `Adds ${T} to the vault backing`],
                [<code key="5">sweepEthFees()</code>, "Anyone", "Sends accrued ETH fees to the fee address fixed at deploy"],
              ]}
            />
            <p>
              Read-only views: <code>isKnownRoot</code>, <code>getLastRoot</code>, <code>spentMany</code>, <code>valueOfShares</code>,{" "}
              <code>previewShroudShares</code>, <code>state</code>, <code>extDataHash</code> and <code>zeros</code>.
            </p>
          </>
        ),
      },
      {
        id: "events",
        h: "Events",
        body: (
          <ul>
            <li>
              <code>NewCommitment(commitment, leafIndex, encryptedNote)</code>: one per new leaf; wallets scan these to find their notes.
            </li>
            <li>
              <code>NewNullifier(nullifier)</code>: one per spent note.
            </li>
            <li>
              <code>Shrouded(asset, from, amount, fee, noteValue, leafIndex)</code>: the public side of a deposit.
            </li>
            <li>
              <code>PrivateTransfer(asset, transferFee, relayer, relayerPaid)</code>: that a private send happened, and its fees.
            </li>
            <li>
              <code>Unshrouded(asset, recipient, relayer, amountOut, relayerPaid, protocolFee)</code>: the public side of an exit.
            </li>
            <li>
              <code>YieldAdded</code>, <code>SharesBurned</code>, <code>Donated</code>: {T} reaching the vault.
            </li>
            <li>
              <code>EthFeeAccrued</code>, <code>EthFeesSwept</code>: ETH fees building up and leaving for the fee address.
            </li>
          </ul>
        ),
      },
      {
        id: "errors",
        h: "Errors",
        body: (
          <Table
            head={["Error", "When"]}
            rows={[
              [<code key="1">UnknownRoot</code>, "The proof names a root outside the last 100"],
              [<code key="2">NullifierSpent, SameNullifier</code>, "A note was already spent, or both inputs are the same note"],
              [<code key="3">InvalidProof</code>, "The verifier rejected the proof"],
              [<code key="4">NotRelayer, BadRelayer</code>, "A relayer-paid spend sent by someone else, or a relayer fee with no relayer"],
              [<code key="5">BadRecipient, ExitTooSmall</code>, "Missing or unexpected recipient, or an exit that does not cover its fees"],
              [<code key="6">BadAmount, BadAsset</code>, "A zero or mismatched amount, or an asset other than 0 and 1"],
              [<code key="7">NotInField, ValueTooLarge, NoteTooLarge</code>, "An input outside the proof field, a value above 2^120, an encrypted note over 512 bytes"],
              [<code key="8">FeeOnTransferToken, ZeroShares</code>, "The token arrived short, or a shroud too small to mint a share"],
              [<code key="9">TreeFull</code>, "All 2^24 leaves are used"],
              [<code key="10">EthTransferFailed, NothingToSweep</code>, "An ETH payout failed, or there are no ETH fees to sweep"],
              [<code key="11">BadParameter</code>, "The constructor refused a setting, such as a fee above 5%"],
            ]}
          />
        ),
      },
      {
        id: "no-admin",
        h: "What is deliberately missing",
        body: (
          <p>
            No <code>owner</code>, no admin function, no pause, no proxy and no <code>upgradeTo</code>, no function that moves or freezes
            a note, and no fee setter. Every parameter is a constructor argument, fixed forever at deploy; the full list is on the{" "}
            <Link href="/docs/parameters">parameters page</Link>.
          </p>
        ),
      },
      {
        id: "verify",
        h: "Verify a deployment",
        body: (
          <>
            <p>
              Once addresses are published, anyone can check them against this code. From the repository, run{" "}
              <code>npm run verify-deployment -- &lt;address&gt; --tx &lt;creation tx&gt;</code>. It compares the deployed bytecode byte
              for byte with this build, checks each linked library the same way, decodes the fixed settings (verifier, token, fee address
              and fees) and, with <code>--tx</code>, checks the creation input and constructor arguments. Any mismatch fails.
            </p>
            <p>
              The verified source, every transaction and every event can also be read on{" "}
              <a href={CHAIN.explorer} target="_blank" rel="noreferrer">
                Blockscout
              </a>
              .
            </p>
          </>
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
            A wallet integration needs three things: key derivation from a signature, an indexer for <code>NewCommitment</code> events to
            find the user&apos;s notes, and the prover to build proofs locally. A reference SDK is planned; until then, this site&apos;s
            own code is the reference.
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
    lede: "Commitments from the team, its remaining powers, and what is still pending.",
    title: "Team Powers",
    description: `The ${N} trust model: a pool with no owner, no admin function and no proxy, exits nobody can pause, and what still waits on deployment.`,
    keyword: "no admin keys immutable",
    sections: [
      {
        id: "commitments",
        h: "Commitments",
        body: (
          <ul>
            <li>No owner and no admin function in the pool contract, and no upgradeable proxy.</li>
            <li>No pause on shrouds, private transfers or exits, ever: the contract has no pause function.</li>
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
              ["Choose the constructor settings before deployment", "Alter a setting once deployed"],
              [`Receive swept ETH fees at the fee address and swap them into ${T} (expected, not enforced)`, "Pause shrouds, transfers, exits or donations"],
              ["Collect the team's portion of each creator fee", "Move, freeze or redirect any note"],
            ]}
          />
        ),
      },
      {
        id: "unproven",
        h: "Check it yourself",
        body: (
          <p>
            Every item above can be checked on chain. The <Link href="/docs/deployments">deployments page</Link> lists each address, and
            anyone can run <code>npm run verify-deployment</code> to prove the bytecode and constructor settings match this code.
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
            move to. The code is open source and tested, and anyone can check a deployment against it, but no check removes this risk.
            Shroud only an amount whose loss you could carry.
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
    lede: "The fixed values of the pool contract, set once at deploy.",
    title: "Parameters",
    description: `${N} pool parameters: assets, default fee rates, Merkle tree depth, root window, share offset and proof system, all fixed when the contract is deployed.`,
    keyword: "protocol parameters",
    sections: [
      {
        id: "values",
        h: "Values",
        body: (
          <Table
            head={["Parameter", "Value", "Status"]}
            rows={[
              ["Assets", `ETH (0), ${T} (1)`, "In the code"],
              ["Network", `${C} (${CHAIN.id})`, "Decided"],
              ["Shroud fee", "0.25%", "Fixed at deploy"],
              ["Private transfer fee", "0.10%", "Fixed at deploy"],
              ["Unshroud fee", `0.0005 ETH or 20 ${T}, flat`, "Fixed at deploy"],
              ["Maximum fee", "5% (500 bps)", "Enforced by the constructor"],
              ["Merkle tree depth", "24", "In the code"],
              ["Recent roots accepted", "100", "In the code"],
              ["Largest note value", "2^120", "In the code"],
              ["Vault share offset", "1,000,000 virtual shares", "In the code"],
              ["Proof system and hash", "UltraHonk (Noir circuit), Poseidon; no project-specific trusted setup", "In the code"],
              ["Fee address", addrCell(CONTRACTS.feeSink, "fs"), "Fixed at deploy"],
            ]}
          />
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
    description: `Glossary of ${N} terms: shroud, unshroud, note, commitment, nullifier, root, vault share, viewing key and anonymity set, explained briefly.`,
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
    description: `The ${N} roadmap: private pool and holder yield first, then private settlement, private swaps and community privacy coins on ${C}.`,
    keyword: "privacy protocol roadmap",
    sections: [
      {
        id: "now",
        h: "Now: site, token, pool",
        body: (
          <ul>
            <li>This site and live chain readings.</li>
            <li>{T} launched on Pons, with the address published here.</li>
            <li>The pool, its proof verifier and libraries, deployed and verified on {C}.</li>
          </ul>
        ),
      },
      {
        id: "next",
        h: "Next: fees into the vault",
        body: (
          <ul>
            <li>Fee harvester routing swept ETH fees and the creator fee into the vault as {T}, operated off-chain at first.</li>
          </ul>
        ),
      },
      {
        id: "then",
        h: "Then: private settlement",
        body: (
          <ul>
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
