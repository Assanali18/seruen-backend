
export interface Event {
    title: string;
    date?: string | null;
    description?: string;
    time?: string|undefined;
    venue?: string;
    price?: string;
    ticketLink?: string;
  }
  
  export interface Seat {
    id: number;
    hall_id: number;
    sector_id: number;
    sector_name: string;
    name: string | null;
    row: number;
    column: number;
    x: number;
    y: number;
    scale: number | null;
    status: number;
    available: number;
    seatPrice: {
      id: number;
      seat_id: number;
      type: string | null;
      rate: {
        id: number;
        title: string;
        status: number;
        price: number;
        weekend_price: number;
        limits: number;
        dates: any[];
        amounts: any[];
      }
    } | null;
  }