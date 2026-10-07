import { BRAND, CHAIN } from "@/config/brand";

/**
 * Home FAQ. Rendered as visible text and published as FAQPage structured
 * data from the same array, so the two can never disagree.
 */
export const HOME_FAQ: [string, string][] = [
  [
    `What is ${BRAND.name}?`,
    `${BRAND.name} is a privacy protocol built for ${CHAIN.name}. ETH or ${BRAND.symbol} deposited into a shared pool becomes a note readable only with your keys, and holders of shrouded ${BRAND.symbol} are designed to collect a cut of every fee the protocol earns.`,
  ],
  [
    `How does ${BRAND.name} work?`,
    `Three moves. Shroud: deposit ETH or ${BRAND.symbol} and get an encrypted note back. Hold: the note sits in the pool and, for ${BRAND.symbol}, its share of the fee vault grows as fees arrive. Spend or unshroud: pass the value on privately, or exit to an address you choose, backed by a zero-knowledge proof revealing nothing about which note paid.`,
  ],
  [
    `How do I buy ${BRAND.symbol}?`,
    `${BRAND.symbol} is planned as a standard ERC-20 token for ${CHAIN.name}, listed through the Pons launchpad. Once the contract address is published on the token page, you purchase it from the Pons bonding curve with ETH, and after graduation in its Uniswap v4 pool. The address is not published yet, so there is nothing to buy today.`,
  ],
  [
    `Which network is ${BRAND.name} on?`,
    `${CHAIN.name} mainnet, chain id ${CHAIN.id}. ETH pays for gas there. Any EVM wallet that can add a custom network works, and this site adds the network for you when you connect.`,
  ],
  [
    "Do public holders earn anything?",
    `No. Fees are designed to flow only to the vault behind shrouded ${BRAND.symbol}. A wallet that simply holds ${BRAND.symbol} in public gets no share of them. That gap is the reason to shroud.`,
  ],
  [
    "Who controls the contracts?",
    "Nobody. The pool contract has no owner, no admin function, no pause and no proxy, and every parameter is fixed in its constructor, so no team member can move, freeze or redirect a note. The contracts are written and tested but not deployed yet; their addresses will be published in the docs once they are live.",
  ],
  [
    `Does ${BRAND.name} make me anonymous?`,
    `It conceals your balance and your counterparties inside the pool. Entering and leaving the pool remain public transactions, and your IP address, plus anything you tell other services, is outside its reach. The protection scales with the crowd: the more notes in the pool, the harder any one of them is to single out.`,
  ],
  [
    "Which fees does Oarkel charge?",
    `A creator fee on ${BRAND.symbol} trades, a 0.25% shroud fee, a 0.10% private transfer fee and a flat unshroud fee of 0.0005 ETH or 20 ${BRAND.symbol}. Those are the values the pool will be deployed with, and they are fixed forever at deploy; the contract refuses any fee above 5%. Gas is paid in ETH by the wallet that sends each transaction. The practice app uses the same rates.`,
  ],
  [
    "Do I need ETH to shroud or unshroud?",
    "You need a little ETH for gas in the wallet you connect. Every shroud, private payment and unshroud is sent from that wallet. The address that receives an unshroud needs nothing: it only receives.",
  ],
  [
    "What are the risks?",
    `Contract risk first: an immutable contract cannot be patched if a bug is found, which is the price of having no admin. Then legal risk, since rules on privacy tools differ by country and can change. Then market risk: the price of ${BRAND.symbol} can fall. Put in only money you are prepared to lose entirely.`,
  ],
];
