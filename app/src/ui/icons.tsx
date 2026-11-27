import {
  Backpack, Baby, Building2, CalendarDays, CalendarPlus, CalendarRange, Cake, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  CircleAlert, Clock, Flag, GraduationCap, Handshake, House, Info, Link2, ListChecks, Moon, Pencil, Plane, Plus, School, Settings,
  ShoppingCart, Stethoscope, Sun, Trash2, TreePalm, TriangleAlert, Undo2, User, Users, UsersRound, X, MapPin, Phone, StickyNote, ExternalLink, Bell, Menu, Rows3, Columns3, Eye, CalendarCheck, Layers, Search, RefreshCw, Ticket, Luggage, Repeat, ListTodo, FolderHeart, Lock, Send, Copy, RotateCcw,
  UtensilsCrossed, ArrowLeftRight, Archive, FolderInput,
} from 'lucide-preact';
import type { ParentStatus } from '../core/calendar';

const MAP = {
  office: Building2,
  home: House,
  ticket: Ticket,
  repeat: Repeat,
  listcheck: ListTodo,
  folder: FolderHeart,
  lock: Lock,
  send: Send,
  copy: Copy,
  reset: RotateCcw,
  luggage: Luggage,
  palm: TreePalm,
  plane: Plane,
  week: CalendarDays,
  year: CalendarRange,
  cart: ShoppingCart,
  tasks: ListChecks,
  settings: Settings,
  plus: Plus,
  x: X,
  left: ChevronLeft,
  right: ChevronRight,
  down: ChevronDown,
  up: ChevronUp,
  warn: TriangleAlert,
  alert: CircleAlert,
  check: Check,
  info: Info,
  edit: Pencil,
  trash: Trash2,
  undo: Undo2,
  hand: Handshake,
  baby: Baby,
  backpack: Backpack,
  school: School,
  bridge: Link2,
  cake: Cake,
  clock: Clock,
  user: User,
  users: Users,
  sun: Sun,
  moon: Moon,
  flag: Flag,
  doctor: Stethoscope,
  exam: GraduationCap,
  meeting: UsersRound,
  addcal: CalendarPlus,
  pin: MapPin,
  phone: Phone,
  note: StickyNote,
  link: ExternalLink,
  bell: Bell,
  menu: Menu,
  rows: Rows3,
  cols: Columns3,
  eye: Eye,
  today: CalendarCheck,
  layers: Layers,
  search: Search,
  refresh: RefreshCw,
  meal: UtensilsCrossed,
  swap: ArrowLeftRight,
  move: FolderInput,
  pool: Archive,
} as const;

export type IconName = keyof typeof MAP;

export function Ic({ n, size = 18, class: cls = '', sw = 2 }: { n: IconName; size?: number; class?: string; sw?: number }) {
  const C = MAP[n];
  return <C size={size} strokeWidth={sw} class={`ic ${cls}`} aria-hidden="true" />;
}

const STATUS: Record<ParentStatus, IconName | null> = { free: null, office: 'office', homeoffice: 'home', vacation: 'palm', trip: 'plane' };
export function StatusIc({ s, size = 18 }: { s: ParentStatus; size?: number }) {
  const n = STATUS[s];
  return n ? <Ic n={n} size={size} class={`st-ic st-ic-${s}`} /> : null;
}
