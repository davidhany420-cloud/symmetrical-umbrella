export type Gender = 'male' | 'female';
export type Mode = 'boys' | 'girls';
export type Role = 'client' | 'captain';
export type BikeClassId = 'scooter' | 'classic' | 'electric' | 'sport';
export type BookingType = 'monthly' | 'once';

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  gender: Gender;
  createdAt: number;
}

export interface CaptainProfile {
  userId: string;
  bikeClass: BikeClassId;
  bikeModel: string;
  plate: string;
  governorate: string;
  nationalId: string;
  photo?: string;
  idPhoto?: string;
  licensePhoto?: string;
  bikePhoto?: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejectReason?: string;
  submittedAt?: number;
  reviewedAt?: number;
  /** epoch ms; subscription is active while now < activeUntil */
  activeUntil?: number;
  pendingPayment?: { id: string; ref: string; receipt?: string; at: number };
  rating: number;
  ratingCount: number;
  trips: number;
  online: boolean;
}

export interface Line {
  id: string;
  name: string;
  governorate: string;
  from: string;
  to: string;
  time: string;
  price: number;
  active: boolean;
}

export interface Message {
  id: string;
  from: 'client' | 'captain' | 'system';
  text: string;
  at: number;
}

export type BookingStatus =
  | 'pending'     // waiting for captain answer
  | 'countered'   // captain proposed another price
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'done';

export interface Booking {
  id: string;
  clientId: string;
  captainId: string;
  mode: Mode;
  type: BookingType;
  from: string;
  to: string;
  time: string;
  days: number[];
  bikeClass: BikeClassId;
  offer: number;
  counter?: number;
  price?: number;
  status: BookingStatus;
  createdAt: number;
  messages: Message[];
  rating?: number;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
}

/** A captain's last position while they share location */
export interface LivePos {
  captainId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  at: number;
}

export interface Place {
  label: string;
  lat?: number;
  lng?: number;
}

export interface Notice {
  id: string;
  to: 'admin' | string; // 'admin' or a user id
  text: string;
  at: number;
  read: boolean;
}

export interface PaymentLog {
  id: string;
  captainId: string;
  ref: string;
  amount: number;
  at: number;
  status: 'approved' | 'rejected';
  reviewedAt: number;
}

export interface State {
  /** false until the first load from the server finishes */
  ready: boolean;
  users: User[];
  captains: CaptainProfile[];
  lines: Line[];
  bookings: Booking[];
  notices: Notice[];
  payments: PaymentLog[];
  live: LivePos[];
  sessionUserId: string | null;
  isAdmin: boolean;
}
