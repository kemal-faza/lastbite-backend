import type { UserResponse } from '../types/index.js';

export function toUserResponse(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  isVerified: boolean;
  createdAt: Date;
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
