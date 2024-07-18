export interface CreateUserDto {
  userName: string;
  email: string;
  phone: string;
  spendingLimit: number;
  hobbies: string[];
  schedule: string[];
}
