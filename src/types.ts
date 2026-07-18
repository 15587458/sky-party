/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChartElement {
  id: string;
  type: 'seat' | 'table' | 'fanzone' | 'text' | 'shape';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  rotation?: number;
  label?: string;
  priceType: 'standard' | 'vip';
  fill?: string;
  points?: number[]; // for fanzone polygons
  sellAsWhole?: boolean; // for tables
  seatsCount?: number; // for tables
  assignedSeats?: string[]; // for tables if seats are separate
  parentId?: string; // for seats linked to tables
  capacity?: number; // for fanzone
  isBlocked?: boolean; // for admin blocking
}

export interface Chart {
  id: string;
  name: string;
  elements?: ChartElement[];
  elementsCount?: number; 
  backgroundImage?: string;
  createdAt: number;
  updatedAt?: any;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  price: string;
  priceMax?: string;
  vipPrice?: string;
  imageUrl: string;
  ticketLink: string;
  isActive: boolean;
  chartId?: string;
  seatingChart?: string; // JSON string of elements (fallback for legacy or small events)
  endDate?: number; // Timestamp in ms
  createdAt: number;
  hasSeatingChart?: boolean;
}

export interface Order {
  id: string;
  eventId: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  status: 'pending' | 'paid' | 'cancelled' | 'used';
  price: number;
  quantity: number;
  ticketType: 'standard' | 'vip' | 'free';
  elementId?: string; // ID of the seat/table/fanzone
  ticketId?: string;
  scannedCount: number;
  scannedTickets?: string[]; // Array of sub-tickets scanned e.g. ["1", "2"]
  scannedAt?: string; // For backwards compatibility
  scannedAtTimes?: Record<string, string>; // Maps sub-ticket id (e.g. "1") to scan time timestamp string
  monobankInvoiceId?: string;
  returnedCount?: number;
  createdAt: number;
}

export interface PrivateSettings {
  monobankToken?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpHost?: string;
  smtpPort?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface SiteConfig {
  logoUrl?: string;
  instagramUrl: string;
  telegramUrl?: string;
  facebookUrl?: string;
  bannerTitle: string;
  footerText: string;
  noEventsMessage: string;
  aboutText?: string;
  contactEmail?: string;
  contactAddress?: string;
  primaryColor?: string; // Hex color code
  bgGradientColor?: string; // Background glow/gradient Hex color code
  bgGradientOpacity?: number; // Background glow/gradient opacity percentage (0-100)
  adminPassword?: string; 
  commissionPercentage?: number;
  ticketBgColor?: string;
  ticketTextColor?: string;
  ticketAccentColor?: string;
  ticketBorderColor?: string;
  ticketLogoUrl?: string;
  ticketMessage?: string;
  siteUrl?: string;
}
