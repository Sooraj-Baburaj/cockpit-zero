/** Marketing copy shared across pages — mirrors the CockpitZero.dc.html design source. */

export interface HeroQuery {
  q: string;
  results: { icon: string; title: string; sub: string; kind: string }[];
}

export const HERO_QUERIES: HeroQuery[] = [
  { q: 'git', results: [{ icon: '↗', title: 'Open GitHub Repository', sub: 'Action · git', kind: 'action' }] },
  { q: 'shot reg', results: [{ icon: '▣', title: 'Capture Region', sub: 'Action · screenshot', kind: 'action' }] },
  { q: 'inv 4821', results: [{ icon: '#', title: 'Open Invoice #4821', sub: 'Action · billing', kind: 'action' }] },
  { q: 'standup', results: [{ icon: '⧉', title: 'Join Daily Standup', sub: 'Workflow · calendar', kind: 'flow' }] },
];

export interface Step {
  n: string;
  tag: string;
  title: string;
  body: string;
  media: string;
}

export const STEPS: Step[] = [
  {
    n: '01',
    tag: 'Search',
    title: 'Press one key. Search everything.',
    body: 'No dock, no desktop, no Alt-Tab Olympics — one hotkey from anywhere. Photoshop, a PDF, that shell script from six months ago, the workflow that deploys prod: all searched together. Hit Enter. That is it.',
    media: 'everything, searched together',
  },
  {
    n: '02',
    tag: 'Actions',
    title: 'Apps are just the beginning',
    body: 'Launching apps is table stakes. CockpitZero also runs shell commands, URLs, folders, files, snippets, and custom actions — anything you can script. Keep typing after the name and everything you add becomes the input.',
    media: 'run anything you can script',
  },
  {
    n: '03',
    tag: 'Workflows',
    title: 'Turn five minutes into one word',
    body: 'Open Jira, checkout the branch, install deps, boot the dev server, open your editor — or just type "dev". One action, one Enter, six things happen. Go spend the four minutes you saved on coffee.',
    media: 'dev → six things happen',
  },
  {
    n: '04',
    tag: 'AI Cockpit',
    title: 'Give your launcher a memory',
    body: 'AI Cockpit remembers your projects, preferences, and recurring tasks — say "continue what I was doing yesterday" and it knows. Bring your own key and stay local, or sign in and let it route to the right model.',
    media: 'memory + your own AI',
  },
];

export interface UseCase {
  tag: string;
  dur: string;
  title: string;
}

export const USE_CASES: UseCase[] = [
  { tag: 'Search', dur: '0:24', title: 'Find literally anything.' },
  { tag: 'Actions', dur: '0:31', title: 'Commands with arguments.' },
  { tag: 'Workflows', dur: '0:38', title: 'One Enter. Six things happen.' },
  { tag: 'AI Cockpit', dur: '0:29', title: 'Memory included.' },
];

export interface Plan {
  name: string;
  price: string;
  unit: string;
  tagLabel: string;
  accent: boolean;
  cta: string;
  cta2: string | null;
  blurb: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: '$0',
    unit: '',
    tagLabel: 'Free forever',
    accent: false,
    cta: 'Download',
    cta2: null,
    blurb: 'The full launcher on all your devices. Bring your own API key for AI.',
    features: [
      'Global hotkey & command bar',
      'Apps, files & fuzzy search',
      'Unlimited custom actions',
      'Multi-step workflows',
      'BYOP — your own AI key',
      'Local-first, no account',
    ],
  },
  {
    name: 'Pro',
    price: '$8',
    unit: '/mo',
    tagLabel: 'Most popular',
    accent: true,
    cta: 'Start free trial',
    cta2: 'Download',
    blurb: 'Managed AI with memory that syncs everywhere. No keys to juggle.',
    features: [
      'Everything in Starter',
      'Managed AI, auto model routing',
      'Persistent memory, synced',
      'Config & knowledge sync',
      'Priority updates',
    ],
  },
  {
    name: 'Team',
    price: '$14',
    unit: '/user·mo',
    tagLabel: 'New',
    accent: false,
    cta: 'Start free trial',
    cta2: 'Contact sales',
    blurb: 'Shared actions and workflows with central billing and controls.',
    features: [
      'Everything in Pro',
      'Shared action libraries',
      'Team workflow packs',
      'Admin & usage controls',
      'SSO / SAML',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    unit: '',
    tagLabel: 'Now available',
    accent: false,
    cta: 'Contact sales',
    cta2: null,
    blurb: 'Self-hosting, compliance, and support tuned to your org.',
    features: [
      'Everything in Team',
      'Self-host / VPC option',
      'SCIM provisioning',
      'Audit logs & DLP',
      'Dedicated support',
    ],
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'Do I need an account?',
    a: 'No. You can install CockpitZero and never create one — the launcher does not care. Accounts only exist to sync things across devices.',
  },
  {
    q: 'Does it work offline?',
    a: 'Yes. If your computer works, CockpitZero works. Internet optional, keyboard required.',
  },
  {
    q: 'Is my data private?',
    a: 'In local mode, everything stays on your machine. Managed AI is exactly that — managed because you asked for it, not because we secretly wanted your data.',
  },
  {
    q: 'Electron?',
    a: 'Yep. One codebase, three operating systems. The launcher itself stays intentionally tiny, so pressing the hotkey still feels instant.',
  },
  {
    q: 'Can I use my own AI provider?',
    a: 'Absolutely. Bring Claude, GPT, Gemini, or your weird self-hosted endpoint running in a closet. We are not judging.',
  },
];

export interface FooterCol {
  title: string;
  links: { label: string; href: string }[];
}

export const FOOTER_COLS: FooterCol[] = [
  {
    title: 'Product',
    links: [
      { label: 'Download', href: '/download' },
      { label: 'Features', href: '/product' },
      { label: 'Workflows', href: '/product' },
      { label: 'AI Cockpit', href: '/product' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Blog', href: '#' },
      { label: 'Community', href: '#' },
      { label: 'Privacy', href: '#' },
      { label: 'Status', href: '#' },
    ],
  },
];

export const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '#' },
];
