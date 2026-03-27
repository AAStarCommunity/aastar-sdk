// @aastar/xiaoheishu — 小黑书 (XiaoHeiShu) decentralized lifestyle community (M14)
// Built on AT Protocol (public content) + Spore Protocol (E2E DM + payments)

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  XiaoHeiNote,
  XiaoHeiAuthor,
  XiaoHeiImage,
  XiaoHeiLocation,
  XiaoHeiPrice,
  XiaoHeiTip,
  XiaoHeiConfig,
  FeedItem,
  NoteCategory,
} from './types.js';

// ─── Components ───────────────────────────────────────────────────────────────
export { NoteCard } from './components/NoteCard.js';
export type { NoteCardProps } from './components/NoteCard.js';

export { FeedList } from './components/FeedList.js';
export type { FeedListProps } from './components/FeedList.js';

export { CreateNoteForm } from './components/CreateNoteForm.js';
export type { CreateNoteFormProps } from './components/CreateNoteForm.js';

export { DmThread } from './components/DmThread.js';
export type { DmThreadProps } from './components/DmThread.js';

export { PaymentModal } from './components/PaymentModal.js';
export type { PaymentModalProps } from './components/PaymentModal.js';

export { ProfileCard } from './components/ProfileCard.js';
export type { ProfileCardProps } from './components/ProfileCard.js';

// ─── Pages ────────────────────────────────────────────────────────────────────
export { FeedPage } from './pages/FeedPage.js';
export type { FeedPageProps } from './pages/FeedPage.js';

export { DmPage } from './pages/DmPage.js';
export type { DmPageProps } from './pages/DmPage.js';

export { ProfilePage } from './pages/ProfilePage.js';
export type { ProfilePageProps } from './pages/ProfilePage.js';
