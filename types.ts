
export interface TravelFormData {
  destination: string;
  startDate: string;
  travelers: string;
  budget: string;
  days: string;
  personality?: string;
}

export type LocationType = 'hotel' | 'food' | 'spot';

export interface RouteCoordinate {
  day?: string; // e.g., "Day 1"
  time?: string; // e.g., "09:00", "12:30" - The scheduled time in the itinerary
  name: string;
  desc: string;
  lat?: number; // Made optional to allow timeline items without map pins
  lng?: number; // Made optional
  type?: LocationType;
  opening_hours?: string;
  contact?: string;
  rating?: string;
  review?: string;
  cost?: string; // e.g., "¥120", "免费"
}

export interface ParsedResponse {
  rawText: string;
  metadata?: {
    total_budget_est: string;
    tags: string[];
    route_coordinates: RouteCoordinate[];
  };
  groundingMetadata?: any;
}

export enum ViewState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}

export interface CommunityReview {
  id: string;
  userName: string;
  avatarColor: string;
  locationName: string;
  type: LocationType;
  rating: number;
  content: string;
  date: string;
  likes: number;
  tags: string[];
  image?: string;
}
