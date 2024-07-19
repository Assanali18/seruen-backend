export interface CreateEventDto {
    title: string;
    date?: string | null;
    description?: string;
    time?: string;
    venue?: string;
    price?: string;
    ticketLink?: string;
    views?: number;
    tags?: string[];
  }